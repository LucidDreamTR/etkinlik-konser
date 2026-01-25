# Production Security Checklist

## Environment Validation
- [ ] `/src/lib/env.ts` validates required env vars on boot.
- [ ] `BACKEND_WALLET_PRIVATE_KEY` is server-only and never exposed to client bundles.
- [ ] `ENABLE_PROD_DEBUG` and `ALLOW_UNSIGNED_INTENT` default to false.
- [ ] `GATE_OPERATOR_KEY` set in production.

## Debug Shutoff
- [ ] Debug fields only return when `ENABLE_PROD_DEBUG=true` AND `VERCEL_ENV` is not `production`.
- [ ] Gate debug fields gated by `GATE_VERIFY_DEBUG` and `ENABLE_PROD_DEBUG` outside production.

## Intent & Signature Rules
- [ ] `/api/tickets/intent` always requires signature in production.
- [ ] Intent requests use rate limiting and a KV lock (`intent:lock:<merchantOrderId>`).

## Rate Limit + Idempotency Locks
- [ ] Purchase uses per-IP rate limiting and `purchase:lock:<merchantOrderId>`.
- [ ] Claim uses per-IP rate limiting and `claim:lock:<tokenId|merchantOrderId>`.
- [ ] Gate verify uses per-IP rate limiting and `gate:lock:<tokenId>`.

## Permissions & Authorization
- [ ] Gate verify requires `x-operator-key` header in production.
- [ ] Claim requires claim code and verifies paymentId/tokenId mapping on-chain.

## No-Cache Responses
- [ ] Purchase, intent, claim, and gate verify responses include `Cache-Control: no-store`.

## Logging & Redaction
- [ ] All logging uses `/src/lib/logger.ts` with redaction.
- [ ] Logs never include private keys, KV tokens, claim codes, or raw preimages.

## Key Hygiene
- [ ] `.gitignore` excludes `.env.local` and `.env*.local`.
- [ ] `npm run security:check` used in CI.
- [ ] `/docs/security.md` has pre-commit guidance.
