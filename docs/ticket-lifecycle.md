# Ticket Lifecycle

This document defines the single source of truth for ticket lifecycle states and how API endpoints may transition them.

## State definitions
- `intent_created`: An order intent exists; no confirmed payment.
- `paid`: Payment confirmed, but token not yet minted.
- `minted`: Token minted (custody or buyer), but not yet claimed by buyer in lifecycle.
- `claimable`: Token is ready to be claimed by buyer (custody holds the token).
- `claimed`: Buyer owns the token.
- `gate_validated`: Ticket has been accepted at the gate; terminal state.

## Allowed transitions
| From | To |
| --- | --- |
| `intent_created` | `paid`, `minted` |
| `paid` | `minted`, `claimable` |
| `minted` | `claimable`, `claimed` |
| `claimable` | `claimed` |
| `claimed` | `gate_validated` |
| `gate_validated` | _(terminal)_ |

Same-state transitions are always permitted for idempotency.

## Mint modes
Minting behavior is controlled by `MINT_MODE` (server env).

- `direct` (default): tickets are minted directly to the buyer’s wallet. Claim is not required.
- `custody`: tickets are minted to a custody wallet and require a claim transfer to the buyer.

Required envs:
- `MINT_MODE`: `"direct"` or `"custody"` (defaults to `"direct"` if missing).
- `CUSTODY_WALLET_ADDRESS`: required only when `MINT_MODE="custody"`.

Claim requirement:
- Direct mint → `/api/tickets/claim` returns `status="not_required"` and `claimed=true`.
- Custody mint → `/api/tickets/claim` requires `merchantOrderId`, `claimCode`, and `walletAddress`.

## Endpoint mapping
- `/api/tickets/intent`: creates/updates order as `intent_created` (never downgrades).
- `/api/tickets/purchase`:
  - success with txHash → `minted` (and implicitly `paid`).
  - if minted directly to the buyer, lifecycle transitions to `claimed` automatically.
  - success responses include `claimCode` for subsequent `/api/tickets/claim`.
  - pending → no state change, `purchaseStatus="pending"`.
  - duplicate → no state change.
  - signature is required here (intent is unsigned).
- `/api/tickets/claim`:
  - allowed from `minted` or `claimable`.
  - success → `claimed`.
  - already claimed → no state change.
- `/api/gate/verify`:
  - valid scan only from `claimed`.
  - success → `gate_validated` and write used marker.
  - already used → no state change.
  - when a ticket is minted directly to the buyer, a valid gate scan can auto-claim the order before validation.
  - on a valid scan, order is persisted as `gate_validated` with `claimStatus="claimed"`.

## Idempotency rules
- Repeated calls must not regress state.
- Duplicate purchase with existing txHash must not change state.
- Claim and gate verify are safe to retry and must return stable results.
- `gate_validated` is terminal.

## KV keys
- Orders:
  - `order:<merchantOrderId>`
  - `order:token:<tokenId>`
- Locks (unchanged):
  - `purchase:lock:<merchantOrderId>`
  - `claim:lock:<tokenId|merchantOrderId>`
  - `gate:lock:<tokenId>`
- Used markers (event-scoped):
  - `used:event:<eventId>:token:<tokenId>`
  - Backward compatibility: if `used:token:<tokenId>` exists, treat as already used and write the event-scoped key.

## Examples
### Happy path
1. Intent → `intent_created`
2. Purchase success → `minted`
3. Claim success → `claimed`
4. Gate verify success → `gate_validated`

### Duplicate purchase
1. Purchase success → `minted` (txHash stored)
2. Repeat purchase → `duplicate`, state remains `minted`

### Repeated gate scan
1. Gate verify success → `gate_validated`
2. Repeat scan → `already_used`, state remains `gate_validated`
