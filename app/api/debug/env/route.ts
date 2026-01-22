import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasEthereumRpc: Boolean(process.env.ETHEREUM_RPC_URL),
    hasSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  });
}
