import { NextResponse } from "next/server";

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

  return NextResponse.json({
    ok: true,
    hasEthereumRpc: Boolean(process.env.ETHEREUM_RPC_URL),
    hasSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    ticketContractSet: Boolean(ticketContractRaw),
    ticketContractLast4,
    ticketContractKey,
  });
}
