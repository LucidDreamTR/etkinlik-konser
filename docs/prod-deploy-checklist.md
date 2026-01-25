# Production Deploy Checklist (Vercel + Chain)

## Required Environment Variables
Set in **Production** unless noted.

### Public
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID` (e.g., `11155111` for Sepolia)
- `NEXT_PUBLIC_TICKET_SALE_ADDRESS`
- `NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS`

### Server
- `RPC_URL` (server-side RPC; can match `NEXT_PUBLIC_RPC_URL`)
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `BACKEND_WALLET_PRIVATE_KEY`
- `GATE_OPERATOR_KEY`
- `ENABLE_PROD_DEBUG` (default false)
- `ALLOW_UNSIGNED_INTENT` (default false)
- `FEATURE_TICKETING_ENABLED` (default true)

### Vercel-provided
- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_SHA`

## KV Binding Verification
- [ ] KV project created and environment variables present.
- [ ] `/api/health` returns `kvOk: true`.
- [ ] KV read/write works in Preview/Development.

## Build & Runtime
- [ ] Node.js version set to 20.x in Vercel project settings.
- [ ] `npm run build` passes locally.
- [ ] `npm run lint` passes locally.

## Chain Configuration
- [ ] `NEXT_PUBLIC_CHAIN_ID` matches the target chain.
- [ ] `NEXT_PUBLIC_RPC_URL` points to a stable provider.
- [ ] Contract addresses match the target chain (Sepolia for staging/test).
- [ ] `getChainConfig()` does not throw in production.

## Health & Versioning
- [ ] `/api/health` returns commit SHA and expected chainId.
- [ ] Release log line appears on boot with commit SHA.
