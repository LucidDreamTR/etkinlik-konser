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

## Error Reasons
- `already_used`: QR/token has already been validated once.
- `not_owner`: onchain owner does not match stored `claimedTo` (if available).
- `not_claimed`: onchain ticket is not claimed.
- `payment_mismatch`: keccak(preimage) does not match onchain paymentId.
- `payment_missing`: paymentId is zero onchain.
- `invalid_code`: QR preimage string is invalid.
- `onchain_error`: contract read failed.

## Security Assumptions
- **QR code content === payment preimage**.
- **Onchain paymentId is derived ONLY from the QR preimage**.
- `used:token:{tokenId}` in KV is the single source of truth for one-time usage.
- Debug endpoints are disabled in production unless explicitly enabled via env flags.

## Notes
- The gate verification endpoint is read-only onchain but writes to KV for used tracking.
- For diagnostics, enable `GATE_VERIFY_DEBUG=true` to include hashes in responses (do not enable in prod by default).
