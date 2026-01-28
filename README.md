This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses system font stacks for both sans and mono text, so builds work without external font downloads.

## Payments troubleshooting

TicketSale zincirde event konfigürasyonu tutmaz. Event durumu ve fiyat doğrulaması backend tarafındadır; zincir sadece ödeme ve replay kontrolü yapar.

## Production docs

- `docs/architecture.md`
- `docs/architecture-legend.md`
- `docs/prod-security-checklist.md`
- `docs/prod-deploy-checklist.md`
- `docs/operator-runbook.md`
- `docs/ops-visibility.md`
- `docs/security.md`
- `docs/rollback-plan.md`

## Supported networks
- Default: Sepolia or Holesky (testnets).
- Mainnet requires `MAINNET_ENABLED=true` and `NEXT_PUBLIC_CHAIN_ID=1`.
 - Network-specific env vars required: `NEXT_PUBLIC_RPC_URL_SEPOLIA` / `NEXT_PUBLIC_RPC_URL_MAINNET` and matching TicketSale/EventTicket addresses.

## Local seeding

Deploy local contracts and print addresses:

```bash
npx hardhat run scripts/seed-local.js --network localhost
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
