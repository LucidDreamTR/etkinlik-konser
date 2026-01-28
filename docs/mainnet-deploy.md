# Mainnet Deployment (Hardhat)

## Required environment variables
- `DEPLOYER_PRIVATE_KEY`
- `MAINNET_RPC_URL`
- `MAINNET_ENABLED=true` (required for mainnet deploy safety)
- `CONFIRM_MAINNET_DEPLOY=true` (required for mainnet deploy safety)
- `BACKEND_WALLET_ADDRESS` (preferred) or `BACKEND_WALLET_PRIVATE_KEY`

## Commands
```bash
npm run hh:compile
npm run hh:deploy:mainnet
```

## Expected output
Look for the output block:
- `CHAIN_ID=1`
- `EVENT_TICKET_ADDRESS=0x...`
- `DEPLOY_TX=0x...`
- `DEPLOYER_ADDRESS=0x...`
- `BACKEND_MINTER_ADDRESS=0x...` (if granted)

## Vercel env updates (Mainnet day)
Set these in Production:
- `MAINNET_ENABLED=true`
- `NEXT_PUBLIC_CHAIN_ID=1`
- `NEXT_PUBLIC_RPC_URL_MAINNET=<MAINNET_RPC_URL>`
- `NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_MAINNET=<EVENT_TICKET_ADDRESS>`
- `NEXT_PUBLIC_TICKET_SALE_ADDRESS_MAINNET=<TICKET_SALE_ADDRESS>` (if applicable)

## Post-deploy verification
- Confirm the deploy tx on Etherscan.
- Verify `MINTER_ROLE` is granted to the backend wallet.
- Run `/api/ready` and ensure `rpcOk=true`.
