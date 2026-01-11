import { NextResponse } from "next/server";

import { getOrderByMerchantId, recordOrderStatus } from "@/src/lib/ordersStore";
import { validateServerEnv } from "@/src/server/env";
import { processPayment } from "@/src/server/payments";
import { verifyAndParse } from "@/src/server/payments/providers";

export async function POST(request: Request) {
  try {
    validateServerEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid server env";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!process.env.PAYTR_MERCHANT_KEY || !process.env.PAYTR_MERCHANT_SALT) {
    return NextResponse.json(
      { ok: false, error: "Missing PAYTR_MERCHANT_KEY or PAYTR_MERCHANT_SALT" },
      { status: 400 }
    );
  }
  const verification = verifyAndParse({ headers: request.headers, rawBody });

  if (!verification.ok) {
    const status = verification.reason === "Invalid signature" ? 401 : 400;
    return NextResponse.json({ ok: false, error: verification.reason }, { status });
  }

  const payload = verification.raw;
  const splitSlug = payload.splitSlug || payload.split_slug || "";
  const eventId = payload.eventId || payload.event_id || "";

  if (!splitSlug) {
    return NextResponse.json({ ok: false, error: "Missing splitSlug" }, { status: 400 });
  }
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "Missing eventId" }, { status: 400 });
  }

  try {
    const existing = await getOrderByMerchantId(verification.merchantOrderId);
    if (existing) {
      if (existing.payment_status === "paid" || existing.claimStatus === "claimed") {
        return NextResponse.json({ ok: true, status: "duplicate" });
      }
      if (existing.amountTry && String(existing.amountTry) !== String(verification.totalAmount)) {
        await recordOrderStatus({
          merchantOrderId: verification.merchantOrderId,
          eventId: String(eventId),
          splitSlug,
          buyerAddress: verification.buyerAddress ?? null,
          amountTry: String(verification.totalAmount),
          payment_status: "amount_mismatch",
        });
        return NextResponse.json({ ok: false, error: "Amount mismatch" }, { status: 400 });
      }
    }

    if (verification.status !== "success") {
      await recordOrderStatus({
        merchantOrderId: verification.merchantOrderId,
        eventId: String(eventId),
        splitSlug,
        buyerAddress: verification.buyerAddress ?? null,
        amountTry: String(verification.totalAmount),
        payment_status: verification.status,
      });

      return NextResponse.json({ ok: true, status: "recorded" });
    }

    const result = await processPayment(
      {
        merchantOrderId: verification.merchantOrderId,
        eventId,
        splitSlug,
        buyerAddress: verification.buyerAddress ?? null,
        amountTry: verification.totalAmount,
      },
      { allowPendingToProcess: true }
    );

    if (result.status === "processed" || result.status === "duplicate") {
      return NextResponse.json({ ok: true, status: result.status, ...(result.txHash ? { txHash: result.txHash } : {}) });
    }
    return NextResponse.json({ ok: true, status: "recorded", message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
