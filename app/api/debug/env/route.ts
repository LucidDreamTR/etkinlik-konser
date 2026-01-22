import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID ?? null,
    rpcUrl: process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? null,
    ticketContract: process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS ?? null,
    backendAddress: process.env.BACKEND_WALLET_ADDRESS ?? null,
    backendPkSet: Boolean(process.env.BACKEND_WALLET_PRIVATE_KEY),
    deployerPkSet: Boolean(process.env.DEPLOYER_PRIVATE_KEY),
  });
}
