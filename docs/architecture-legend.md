# Architecture Legend

## QR / Claim Code Formats
- **bytes32 hex**: `0x` + 64 hex chars (already hashed).
- **uuid preimage**: raw UUID string; server computes `keccak256(uuid)` and compares to on-chain `paymentId`.

## Gate Verify Reasons
- `valid`: ticket is valid, claimed, owner ok, paymentId matches.
- `invalid_code`: malformed code or hash mismatch.
- `payment_mismatch`: computed hash does not match on-chain paymentId.
- `not_owner`: on-chain owner does not match expected owner (when applicable).
- `already_claimed`: token already used once (maps to `already_used` in current API responses).
- `rate_limited`: too many requests from same IP.
- `lock_hit`: short-lived KV lock prevents concurrent processing (maps to `temporarily_locked` in current API responses).

## Claim Reasons
- `valid`: claim succeeded.
- `invalid_code`: claim code hash mismatch.
- `payment_mismatch`: orderId / paymentId mismatch on-chain.
- `not_owner`: already claimed by a different wallet.
- `already_claimed`: already claimed for this wallet.
- `rate_limited`: too many requests from same IP.
- `lock_hit`: claim lock already held.
