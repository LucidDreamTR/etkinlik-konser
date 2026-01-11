# Production Plan (Sepolia → Mainnet)

This checklist is a concrete, step-by-step plan to go from local → Sepolia → Mainnet with safe defaults and clear verification steps.

## Environments

### Local (Anvil)
- Start node: `anvil`
- Run app: `npm run dev`
- Local smoke tests:
  - `POST /api/payments/fake-pay` (local only)
  - `POST /api/payments/webhook` with PayTR test hash

### Sepolia (Staging)
- Deploy contracts to Sepolia
- Wire env vars to Sepolia addresses/RPC
- Run full webhook flow with PayTR test account
- Verify mint + claim paths

### Mainnet (Production)
- Deploy contracts to Mainnet
- Wire env vars to Mainnet addresses/RPC
- Enable PayTR prod callbacks
- Enable rate limiting + monitoring

## Required env vars

### Server-only (never NEXT_PUBLIC)
- `PAYTR_MERCHANT_KEY`
- `PAYTR_MERCHANT_SALT`
- `PAYTR_MERCHANT_ID`
- `RELAYER_PRIVATE_KEY`
- `CUSTODY_ADDRESS` (optional; defaults to relayer)
- `RPC_URL` (fallback if `NEXT_PUBLIC_RPC_URL` is not set)

### Public (NEXT_PUBLIC)
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_TICKET_SALE_ADDRESS`
- `NEXT_PUBLIC_TICKET_NFT_ADDRESS`
- `NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_ADDRESS`
- `NEXT_PUBLIC_PAYOUT_SPLITTER_ADDRESS`

### Server + Public (both)
- `TICKET_SALE_ADDRESS` (server reads; keep in sync with NEXT_PUBLIC)

## PayTR production setup
- Set callback URL to `/api/payments/webhook`
- Configure PayTR merchant details:
  - `PAYTR_MERCHANT_KEY`
  - `PAYTR_MERCHANT_SALT`
  - `PAYTR_MERCHANT_ID`
- If PayTR IP allowlist is used, allow only PayTR IPs
- Signature verification:
  - Verify `merchant_oid + merchant_salt + status + total_amount` with HMAC SHA256
  - Reject any invalid signature with 401
- Only process on-chain when `status === "success"`

## Relayer security
- Store `RELAYER_PRIVATE_KEY` in a vault/secret manager
- Rotate keys on a schedule and immediately on incident
- Rate limit webhook intake and on-chain requests
- Implement abuse protection (IP throttling, body size limits)
- Never log private keys or full signature payloads

## RPC strategy
- Use `NEXT_PUBLIC_RPC_URL` as primary
- Set `RPC_URL` as server fallback
- Use timeouts and retries (keep-alive, backoff)
- Monitor RPC latency and error rate

## Contract deploy steps

### Hardhat (example)
- Compile: `npx hardhat compile`
- Deploy with scripts (example):
  - `npx hardhat run scripts/deploy.ts --network sepolia`

### Foundry (example)
- Deploy: `forge script contracts/script/DeployTickets.s.sol --rpc-url $RPC_URL --broadcast --verify`

## Post-deploy configuration
- Set NFT minter:
  - `TicketNFT.setMinter(TicketSale)`
- Configure each split:
  - `PayoutDistributor.setSplit(splitId, recipients, allocations)`
- Configure each event:
  - `TicketSale.setEventConfig(eventId, priceWei, maxSupply, paused)`
- Confirm relayer address:
  - `TicketSale.relayer()` or `TicketSale.trustedRelayer()`

## Verification checklist

### API smoke tests
- `/api/payments/fake-pay` (local only)
- `/api/payments/webhook` (PayTR signature)
- `/api/tickets/intent` (EIP-712)
- `/api/tickets/claim`

### On-chain checks (cast)
- `cast call <sale> "relayer()(address)"`
- `cast call <sale> "eventConfigs(uint256)(uint256,uint256,bool,uint256,bool)" <eventId>`
- `cast call <nft> "ownerOf(uint256)(address)" <tokenId>`

### Idempotency
- Repeat same `merchant_oid` and ensure no duplicate mint
- Verify duplicate returns existing `txHash`

## Monitoring & logging
- Log `txHash`, `merchant_oid`, `status` with redaction
- Never log private keys, full signatures, or claim codes
- Track error taxonomy:
  - `SoldOut`
  - `EventPaused`
  - `MissingEventConfig`
  - `InvalidPayment`
  - `OnlyRelayer`

## Rollback / incident response
- Pause event: `setEventConfig(eventId, priceWei, maxSupply, true)`
- Rotate relayer key and call `setRelayer(newRelayer)`
- Temporarily disable webhook endpoint (edge routing / WAF rule)

## Mainnet readiness
- Confirm chainId is correct in `NEXT_PUBLIC_CHAIN_ID`
- Ensure EIP-712 `verifyingContract` points to Mainnet sale address
- Fund relayer with sufficient ETH for peak load
- Enable rate limiting / bot protection
- Run a 0-amount or minimal payment test before opening traffic

## Troubleshooting note
- If you see `MissingEventConfig` from `/api/payments/fake-pay` or `/api/payments/webhook`, check RPC URL and sale address logs in `src/server/onchainPurchase.ts` first.
