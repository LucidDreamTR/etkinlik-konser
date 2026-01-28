import { NextResponse } from "next/server";

import { getPublicBaseUrl } from "@/lib/site";
import { requireDebugAccess } from "@/src/server/debugFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!requireDebugAccess()) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const mainnetEnabled = process.env.MAINNET_ENABLED === "true";
  const publicContract = mainnetEnabled
    ? process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_MAINNET?.trim()
    : process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA?.trim();
  const ticketContractRaw = publicContract || null;
  const ticketContractKey = publicContract
    ? mainnetEnabled
      ? "NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_MAINNET"
      : "NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA"
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
    mainnetEnabled,
  });
}
