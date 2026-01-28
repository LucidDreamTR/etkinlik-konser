# Production Security Checklist

## Environment Validation
- [x] `/src/lib/env.ts` validates required env vars on boot. (DONE)
- [x] `BACKEND_WALLET_PRIVATE_KEY` is server-only and never exposed to client bundles. (DONE)
- [x] `ENABLE_PROD_DEBUG` and `ALLOW_UNSIGNED_INTENT` default to false. (DONE)
- [ ] `GATE_OPERATOR_KEY` set in production. (NOTES: verify in production env before launch)

## Debug Shutoff
- [x] Debug fields only return when `ENABLE_PROD_DEBUG=true` AND `VERCEL_ENV` is not `production`. (DONE)
- [x] Gate debug fields gated by `GATE_VERIFY_DEBUG` and `ENABLE_PROD_DEBUG` outside production. (DONE)

## Intent & Signature Rules
- [x] `/api/tickets/intent` always requires signature in production. (DONE)
- [x] Intent requests use rate limiting and a KV lock (`intent:lock:<merchantOrderId>`). (DONE)

## Rate Limit + Idempotency Locks
- [x] Purchase uses per-IP and per-order rate limiting plus `purchase:lock:<merchantOrderId>`. (DONE)
- [x] Claim uses per-IP and per-token rate limiting plus `claim:lock:<tokenId|merchantOrderId>`. (DONE)
- [x] Gate verify uses per-IP and per-token rate limiting plus `gate:lock:<tokenId>`. (DONE)

## Permissions & Authorization
- [x] Gate verify requires `x-operator-key` header in production. (DONE)
- [x] Claim requires claim code and verifies paymentId/tokenId mapping on-chain. (DONE)

## No-Cache Responses
- [x] Purchase, intent, claim, and gate verify responses include `Cache-Control: no-store`. (DONE)

## Mainnet Readiness
- [ ] MAINNET_ENABLED set to true only for mainnet release. (NOTES: keep false for testnets)
- [ ] EventTicket + TicketSale addresses are final and immutable for mainnet. (NOTES: verify with deployment records)

## Logging & Redaction
- [x] All logging uses `/src/lib/logger.ts` with redaction. (DONE)
- [x] Logs never include private keys, KV tokens, claim codes, or raw preimages. (DONE)

## Key Hygiene
- [x] `.gitignore` excludes `.env.local` and `.env*.local`. (DONE)
- [ ] `npm run security:check` used in CI. (NOTES: confirm CI config)
- [x] `/docs/security.md` has pre-commit guidance. (DONE)
