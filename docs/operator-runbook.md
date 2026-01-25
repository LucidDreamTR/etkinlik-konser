# Operator QR/Scan Runbook

## Before Event Checklist
- [ ] `GATE_OPERATOR_KEY` set in production.
- [ ] Confirm `/api/health` returns `ok: true` and expected `chainId`.
- [ ] Verify RPC connectivity from venue (cellular hotspot backup ready).
- [ ] Confirm Vercel logs accessible for incident review.
- [ ] Validate scanner device time is correct.

## Scanning Procedure
Accepted formats:
- **bytes32 orderId** (hex string, `0x` + 64 hex chars)
- **merchantOrderId UUID** (will be hashed to compare with on-chain paymentId)

Steps:
1. Scan QR code.
2. Operator app sends `{ tokenId, code }` to `/api/gate/verify`.
3. API checks on-chain paymentId mapping, owner, and claimed status.

## Result Meanings
- `valid`: ticket OK, admit.
- `invalid`: QR code or payment mismatch.
- `payment_mismatch`: QR code doesn’t match paymentIdOf(tokenId).
- `not_owner`: claimed owner does not match on-chain owner.
- `claimed`: ticket is claimed on-chain.
- `already_used`: ticket already used; do not admit.
- `temporarily_locked`: too many attempts; wait or fallback to manual check.

## Incident Playbooks
### KV Down
- Expect increased lock misses and inability to mark used.
- Fall back to manual verification using on-chain checks only (slower).
- Notify ops and monitor KV.

### RPC Down
- Verification fails on-chain; return `onchain_error`.
- Pause scanning if persistent; use offline backup list if available.

### Double Scan Attempts
- Response should return `already_used`.
- Validate identity if dispute.

### Customer Claims Mismatch
- Ask for wallet address and transaction reference.
- Verify on-chain owner; if mismatch, escalate to ops.

## Troubleshooting Commands
Use redacted values; never paste real secrets.

```bash
curl -sS https://<app-domain>/api/health
```

```bash
curl -sS -X POST https://<app-domain>/api/gate/verify \
  -H 'Content-Type: application/json' \
  -H 'x-operator-key: ***REDACTED***' \
  -d '{"tokenId": "123", "code": "<uuid-or-bytes32>"}'
```
