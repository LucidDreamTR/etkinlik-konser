import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, keccak256, toBytes } from "viem";

import { payoutDistributorAbi } from "@/src/contracts/payoutDistributor.abi";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

function hashSplitId(value: string) {
  return keccak256(toBytes(value.trim()));
}

export async function GET(request: Request) {
  if (process.env.ENABLE_DEBUG_ROUTES !== "true") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const splitSlug = searchParams.get("splitSlug")?.trim() || "";
  if (!splitSlug) {
    return NextResponse.json({ ok: false, error: "Missing splitSlug" }, { status: 400 });
  }

  const distributorRaw =
    process.env.NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_ADDRESS ?? process.env.NEXT_PUBLIC_PAYOUT_CONTRACT_ADDRESS ?? "";
  if (!distributorRaw) {
    return NextResponse.json({ ok: false, error: "Missing payout distributor address" }, { status: 400 });
  }

  let distributorAddress: `0x${string}`;
  try {
    distributorAddress = getAddress(distributorRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payout distributor address" }, { status: 400 });
  }

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  try {
    const splitId = hashSplitId(splitSlug);
    const recipients = await publicClient.readContract({
      address: distributorAddress,
      abi: payoutDistributorAbi,
      functionName: "getSplit",
      args: [splitId],
    });

    let totalBps = 0;
    const normalized = recipients.map((recipient) => {
      const bps = typeof recipient.bps === "bigint" ? Number(recipient.bps) : Number(recipient.bps);
      totalBps += bps;
      return { account: recipient.account, bps };
    });

    return NextResponse.json({
      ok: true,
      splitSlug,
      exists: normalized.length > 0,
      totalBps,
      recipients: normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
