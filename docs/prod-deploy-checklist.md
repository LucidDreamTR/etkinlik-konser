# Production Deploy Checklist (Vercel + Chain)

## Required Environment Variables
Set in **Production** unless noted.

### Public
- `NEXT_PUBLIC_CHAIN_ID` (`11155111` for Sepolia, `1` for Mainnet)
- `NEXT_PUBLIC_RPC_URL_SEPOLIA`
- `NEXT_PUBLIC_TICKET_SALE_ADDRESS_SEPOLIA`
- `NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA`
- `NEXT_PUBLIC_RPC_URL_MAINNET` (Mainnet day only)
- `NEXT_PUBLIC_TICKET_SALE_ADDRESS_MAINNET` (Mainnet day only)
- `NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_MAINNET` (Mainnet day only)

### Server
- `RPC_URL` (server-side RPC; can match selected NEXT_PUBLIC_RPC_URL_*)
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `BACKEND_WALLET_PRIVATE_KEY`
- `GATE_OPERATOR_KEY`
- `ENABLE_PROD_DEBUG` (default false)
- `ALLOW_UNSIGNED_INTENT` (default false)
- `FEATURE_TICKETING_ENABLED` (default true)
- `MAINNET_ENABLED` (default false)
- `MAINNET_RPC_URL` (for Hardhat mainnet deploys)
- `DEPLOYER_PRIVATE_KEY` (for Hardhat deploys)

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
- [ ] `MAINNET_ENABLED=false` with `NEXT_PUBLIC_CHAIN_ID=11155111` for Sepolia.
- [ ] `MAINNET_ENABLED=true` with `NEXT_PUBLIC_CHAIN_ID=1` for Mainnet.
- [ ] Selected `NEXT_PUBLIC_RPC_URL_*` points to a stable provider.
- [ ] Contract addresses match the target chain.
- [ ] `getChainConfig()` does not throw in production.

## Health & Versioning
- [ ] `/api/health` returns commit SHA and expected chainId.
- [ ] Release log line appears on boot with commit SHA.
