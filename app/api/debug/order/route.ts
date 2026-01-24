import { NextResponse } from "next/server";

import { getOrderByMerchantId } from "@/src/lib/ordersStore";

export async function GET(request: Request) {
  const allowProdDebug = process.env.ENABLE_PROD_DEBUG === "true";
  if (process.env.NODE_ENV !== "development" && !allowProdDebug) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const merchantOrderId = searchParams.get("merchantOrderId")?.trim() || "";
  if (!merchantOrderId) {
    return NextResponse.json(
      { ok: false, error: "Provide merchantOrderId query param, e.g. /api/debug/order?merchantOrderId=..." },
      { status: 400 }
    );
  }

  const order = await getOrderByMerchantId(merchantOrderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    merchantOrderId: order.merchantOrderId,
    payment_status: order.payment_status,
    txHash: order.txHash,
    nftAddress: order.nftAddress,
    tokenId: order.tokenId,
    custodyAddress: order.custodyAddress,
    claimStatus: order.claimStatus,
    claimedTo: order.claimedTo,
    claimedAt: order.claimedAt,
    chainClaimed: order.chainClaimed ?? null,
    chainClaimTxHash: order.chainClaimTxHash ?? null,
    chainClaimError: order.chainClaimError ?? null,
  });
}
