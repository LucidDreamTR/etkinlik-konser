import { NextResponse } from "next/server";

import { getPublicBaseUrl } from "@/lib/site";

export async function GET() {
  const maskUrl = (value: string | null) => {
    if (!value) return null;
    try {
      const url = new URL(value);
      const suffix = url.pathname && url.pathname !== "/" ? "/***" : "";
      return `${url.origin}${suffix}`;
    } catch {
      return `${value.slice(0, 8)}***`;
    }
  };

  const rpcRaw = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? null;

  return NextResponse.json({
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID ?? null,
    baseUrl: getPublicBaseUrl(),
    ticketContract: process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS ?? null,
    backendAddress: process.env.BACKEND_WALLET_ADDRESS ?? null,
    rpcUrl: maskUrl(rpcRaw),
    rpcUrlSet: Boolean(rpcRaw),
    backendPkSet: Boolean(process.env.BACKEND_WALLET_PRIVATE_KEY),
    deployerPkSet: Boolean(process.env.DEPLOYER_PRIVATE_KEY),
  });
}
