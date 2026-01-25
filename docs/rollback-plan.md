# Rollback Plan

## Vercel Deploy Rollback
1. Identify the last known-good deployment in Vercel.
2. Promote the previous deployment to production.
3. Re-run smoke checks (`/api/health`, `/api/gate/verify`).

## Environment Rollback
1. Revert recent env var changes in Vercel (Production environment).
2. Ensure `FEATURE_TICKETING_ENABLED=true` if tickets should be sold.
3. Verify KV and RPC URLs are correct.

## On-Chain Considerations
- On-chain minting cannot be rolled back.
- Mitigation: use feature flags to halt ticketing flows.

## Feature Flag Mitigation
- `FEATURE_TICKETING_ENABLED=false` returns 503 for purchase/claim/gate in production.
- Keep `ALLOW_UNSIGNED_INTENT=false` in production.

## Post-Rollback
- Validate `/api/health` and key user flows.
- Audit logs for spikes in errors or lock/rate-limit events.
