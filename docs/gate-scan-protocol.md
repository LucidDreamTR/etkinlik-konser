# Gate Scan Protocol

## Purpose
Verify a ticket at the gate using the QR preimage string. A valid scan is **one-time use**.

## Inputs
- **QR code content**: a raw string (the payment preimage).
- **tokenId**: the ERC-721 token id printed/encoded in the QR payload or lookup context.

## Verification Flow (Server: `/api/gate/verify`)
1. Read onchain state:
   - `ownerOf(tokenId)`
   - `tickets(tokenId)` -> `(eventId, claimed)`
   - `paymentIdOf(tokenId)`
2. Validate:
   - `claimed === true`
   - `paymentIdOnchain` is non-zero
   - `expectedHash = keccak256(preimage)`
   - `expectedHash === paymentIdOnchain`
3. Enforce one-time use (offchain KV):
   - Atomically set `used:token:{tokenId}` via Redis `SET ... NX`.
   - If already set → reject as `already_used`.

## Response Schema (Final)
- `ok`: boolean
- `valid`: boolean
- `reason`: `valid | already_used | not_claimed | payment_mismatch | not_owner | payment_missing | invalid_code | onchain_error | rate_limited | temporarily_locked`
- `tokenId`: string (always)
- `chainId`: number (always)
- `eventId`: string | null (always; null when onchain read does not succeed)
- `owner`: string (present when onchain read succeeds)
- `claimed`: boolean (present when onchain read succeeds)

## Error Reasons
- `already_used`: QR/token has already been validated once.
- `not_owner`: onchain owner does not match stored `claimedTo` (if available).
- `not_claimed`: onchain ticket is not claimed.
- `payment_mismatch`: keccak(preimage) does not match onchain paymentId.
- `payment_missing`: paymentId is zero onchain.
- `invalid_code`: QR preimage string is invalid.
- `onchain_error`: contract read failed.
- `rate_limited`: too many requests from the same IP.
- `temporarily_locked`: too many invalid_code attempts for the tokenId.

## Operator Reason Mapping (UI)
- Allow entry only when `reason=valid` and `valid=true`. All other reasons are invalid/deny.
- `valid` → Show: "Valid ticket" (allow entry)
- `already_used` → Show: "Already used" (deny entry)
- `not_claimed` → Show: "Not claimed" (deny entry)
- `payment_mismatch` → Show: "Invalid QR" (deny entry)
- `not_owner` → Show: "Wrong wallet" (deny entry)
- `payment_missing` → Show: "Unpaid / missing payment" (deny entry)
- `invalid_code` → Show: "Invalid QR" (deny entry)
- `onchain_error` → Show: "Network error — retry" (deny entry)
- `rate_limited` → Show: "Too many attempts — wait and retry" (deny entry)
- `temporarily_locked` → Show: "QR locked — wait and retry" (deny entry)

## Security Assumptions
- **QR code content === payment preimage**.
- **Onchain paymentId is derived ONLY from the QR preimage**.
- `used:token:{tokenId}` in KV is the single source of truth for one-time usage.
- Debug endpoints are disabled in production unless explicitly enabled via env flags.

## Notes
- The gate verification endpoint is read-only onchain but writes to KV for used tracking.
- For diagnostics, enable `GATE_VERIFY_DEBUG=true` to include hashes in responses (do not enable in prod by default).
- Claim endpoint debug fields (e.g., chain claim metadata) only return when `ENABLE_PROD_DEBUG=true`.

## Claim Endpoint (`/api/tickets/claim`)
### Error Reasons
- `rate_limited`: too many requests from the same IP.
- `missing_merchant_order_id`: merchant order id missing.
- `missing_claim_code`: claim code missing.
- `invalid_wallet`: wallet address invalid.
- `order_not_found`: order not found.
- `order_not_paid`: order not paid.
- `already_claimed`: ticket already claimed by this wallet.
- `not_owner`: ticket already claimed by a different wallet.
- `claim_expired`: claim window expired.
- `not_ready`: order not ready for claim (missing token or contract).
- `invalid_code`: claim code invalid.
- `server_misconfigured`: custody key or configuration invalid.
- `claim_failed`: unexpected claim failure.

### Operator Actions (Claim)
- `already_claimed` → Show: "Already claimed" (deny claim)
- `not_owner` → Show: "Claimed by another wallet" (deny claim)
- `invalid_code` → Show: "Invalid claim code" (deny claim)
- `order_not_paid` → Show: "Payment incomplete" (deny claim)
- `claim_expired` → Show: "Claim expired" (deny claim)
- `rate_limited` → Show: "Too many attempts — wait and retry" (deny claim)
- `server_misconfigured` / `claim_failed` → Show: "Service error — retry/notify support" (deny claim)

## Prod Debug Disable Checklist
- `ENABLE_PROD_DEBUG` unset/false.
- `GATE_VERIFY_DEBUG` unset/false.
- `ALLOW_UNSIGNED_INTENT` only for test; disable after MVP in prod.

## Env Flags (Audit)
- `ALLOW_UNSIGNED_INTENT`: test-only; disable in prod.
- `ENABLE_PROD_DEBUG`: must stay unset/false in prod.
- `GATE_VERIFY_DEBUG`: must stay unset/false in prod.

## Production Checklist
- Env vars: `ENABLE_PROD_DEBUG=false`, `GATE_VERIFY_DEBUG=false`, `ALLOW_UNSIGNED_INTENT=false`.
- KV required: Redis/Vercel KV configured (used for `used:token:{tokenId}`).
- RPC required: `ETHEREUM_RPC_URL` (or network-specific `NEXT_PUBLIC_RPC_URL_*`) configured.
- Rate limits: `/api/gate/verify` 30/min/IP; `/api/tickets/claim` 10/min/IP.
