import crypto from "crypto";
import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, getAddress, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getOrderByMerchantId, markOrderClaimed } from "@/src/lib/ordersStore";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { createRateLimiter } from "@/src/server/rateLimit";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";
const claimLimiter = createRateLimiter({ max: 8, windowMs: 60_000 });

type ClaimPayload = {
  merchantOrderId?: string;
  claimCode?: string;
  walletAddress?: string;
};

function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

function hashClaimCode(claimCode: string): string {
  return crypto.createHash("sha256").update(claimCode).digest("hex");
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const rate = claimLimiter(ip);
  if (!rate.ok) {
    const retryAfter = Math.ceil(rate.retryAfterMs / 1000);
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let payload: ClaimPayload;
  try {
    payload = (await request.json()) as ClaimPayload;
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof payload?.merchantOrderId !== "string" || !payload.merchantOrderId.trim()) {
    return NextResponse.json({ ok: false, error: "Missing merchantOrderId" }, { status: 400 });
  }
  if (typeof payload?.claimCode !== "string" || !payload.claimCode.trim()) {
    return NextResponse.json({ ok: false, error: "Missing claimCode" }, { status: 400 });
  }
  if (typeof payload?.walletAddress !== "string" || !isAddress(payload.walletAddress)) {
    return NextResponse.json({ ok: false, error: "Invalid walletAddress" }, { status: 400 });
  }

  const order = await getOrderByMerchantId(payload.merchantOrderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }
  if (order.payment_status !== "paid") {
    return NextResponse.json({ ok: false, error: "Order not paid" }, { status: 400 });
  }
  if (order.claimStatus !== "unclaimed") {
    return NextResponse.json({ ok: false, error: "Already claimed" }, { status: 400 });
  }
  if (!order.custodyAddress || !order.claimCodeHash) {
    return NextResponse.json(
      { ok: true, status: "not_required", message: "Ticket already minted to buyer; no claim needed" },
      { status: 200 }
    );
  }
  if (order.claimExpiresAt) {
    const expiresAt = Date.parse(order.claimExpiresAt);
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
      return NextResponse.json({ ok: false, error: "Claim expired" }, { status: 410 });
    }
  }
  if (!order.tokenId || !order.nftAddress) {
    return NextResponse.json({ ok: false, error: "Order not ready for claim" }, { status: 400 });
  }

  const computed = hashClaimCode(payload.claimCode);
  const computedBuffer = Buffer.from(computed, "utf8");
  const storedBuffer = Buffer.from(order.claimCodeHash, "utf8");
  if (computedBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(computedBuffer, storedBuffer)) {
    return NextResponse.json({ ok: false, error: "Invalid claimCode" }, { status: 401 });
  }

  const custodyKeyRaw =
    process.env.CUSTODY_PRIVATE_KEY ?? process.env.BACKEND_WALLET_PRIVATE_KEY ?? process.env.RELAYER_PRIVATE_KEY;
  if (!custodyKeyRaw) {
    return NextResponse.json(
      { ok: false, error: "Missing custody key (CUSTODY_PRIVATE_KEY or BACKEND_WALLET_PRIVATE_KEY or RELAYER_PRIVATE_KEY)" },
      { status: 500 }
    );
  }
  const custodyKey = (custodyKeyRaw.startsWith("0x") ? custodyKeyRaw : `0x${custodyKeyRaw}`) as `0x${string}`;
  const account = privateKeyToAccount(custodyKey);
  const custodyAddress = getAddress(order.custodyAddress);
  if (account.address !== custodyAddress) {
    return NextResponse.json({ ok: false, error: "Custody key mismatch" }, { status: 500 });
  }

  const walletAddress = getAddress(payload.walletAddress);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });

  try {
    const { request: transferRequest } = await publicClient.simulateContract({
      account,
      address: getAddress(order.nftAddress),
      abi: eventTicketAbi,
      functionName: "safeTransferFrom",
      args: [custodyAddress, walletAddress, BigInt(order.tokenId)],
    });

    const transferTxHash = await walletClient.writeContract(transferRequest);
    await publicClient.waitForTransactionReceipt({ hash: transferTxHash });

    await markOrderClaimed({
      merchantOrderId: order.merchantOrderId,
      claimedTo: walletAddress,
      claimedAt: new Date().toISOString(),
      txHash: transferTxHash,
    });

    return NextResponse.json({ ok: true, status: "claimed", transferTxHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
