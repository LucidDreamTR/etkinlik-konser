import { NextResponse } from "next/server";

import { getPublicBaseUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const publicContract = process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS?.trim();
  const serverContract = process.env.TICKET_CONTRACT_ADDRESS?.trim();
  const ticketContractRaw = publicContract || serverContract || null;
  const ticketContractKey = publicContract
    ? "NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS"
    : serverContract
      ? "TICKET_CONTRACT_ADDRESS"
      : null;
  const ticketContractLast4 = ticketContractRaw ? ticketContractRaw.slice(-4) : null;
  let publicBaseUrl: string | null = null;
  try {
    publicBaseUrl = getPublicBaseUrl();
  } catch {
    publicBaseUrl = null;
  }

  return NextResponse.json({
    ok: true,
    hasEthereumRpc: Boolean(process.env.ETHEREUM_RPC_URL),
    hasSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    publicBaseUrl,
    ticketContractSet: Boolean(ticketContractRaw),
    ticketContractLast4,
    ticketContractKey,
  });
}
