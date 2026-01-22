import { NextResponse } from "next/server";

import { getOrderByMerchantId, recordOrderStatus } from "@/src/lib/ordersStore";
import { validateServerEnv } from "@/src/server/env";
import { processPayment } from "@/src/server/payments";
import { verifyAndParse } from "@/src/server/payments/providers";
import { createRateLimiter } from "@/src/server/rateLimit";

function okResponse() {
  return new Response("OK", { status: 200 });
}

const webhookLimiter = createRateLimiter({ max: 120, windowMs: 60_000 });

function asHex32(value?: string | null): `0x${string}` | undefined {
  if (!value) return undefined;
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as `0x${string}`;
  return undefined;
}

function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  try {
    validateServerEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid server env";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const rawBody = await request.text();
  const strictSignature = process.env.PAYTR_STRICT_SIGNATURE === "true";
  const rate = webhookLimiter(getClientIp(request.headers));
  if (!rate.ok) {
    const retryAfter = Math.ceil(rate.retryAfterMs / 1000);
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  const paytrMode = (process.env.PAYTR_ENV ?? "test").toLowerCase();
  const paytrSuffix = paytrMode === "prod" ? "PROD" : "TEST";
  const merchantKey = process.env[`PAYTR_MERCHANT_KEY_${paytrSuffix}`] ?? process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env[`PAYTR_MERCHANT_SALT_${paytrSuffix}`] ?? process.env.PAYTR_MERCHANT_SALT;
  if (!merchantKey || !merchantSalt) {
    return NextResponse.json(
      { ok: false, error: "Missing PAYTR_MERCHANT_KEY or PAYTR_MERCHANT_SALT" },
      { status: 400 }
    );
  }
  const verification = verifyAndParse({ headers: request.headers, rawBody });

  if (!verification.ok) {
    const status = verification.reason === "Invalid signature" ? 401 : 400;
    if (!strictSignature) {
      console.warn("[paytr.webhook] verification failed", verification.reason);
      return okResponse();
    }
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
        console.log("[paytr.webhook]", {
          merchant_oid: verification.merchantOrderId,
          status: verification.status,
          amount: verification.paymentAmount ?? verification.totalAmount,
          previous_state: existing.payment_status,
          new_state: existing.payment_status,
          decision: "ignored",
          reason: "duplicate",
        });
        return okResponse();
      }
      if (existing.payment_status === "failed" && verification.status === "success") {
        console.log("[paytr.webhook]", {
          merchant_oid: verification.merchantOrderId,
          status: verification.status,
          amount: verification.paymentAmount ?? verification.totalAmount,
          previous_state: existing.payment_status,
          new_state: existing.payment_status,
          decision: "ignored",
          reason: "success_after_failed",
        });
        if (strictSignature) {
          return NextResponse.json({ ok: true, status: "ignored" }, { status: 200 });
        }
        return okResponse();
      }

      const incomingAmount = verification.paymentAmount ?? verification.totalAmount;
      if (existing.amountTry && String(existing.amountTry) !== String(incomingAmount)) {
        await recordOrderStatus({
          merchantOrderId: verification.merchantOrderId,
          orderId: existing?.orderId ?? null,
          eventId: String(eventId),
          splitSlug,
          buyerAddress: verification.buyerAddress ?? null,
          amountTry: String(incomingAmount),
          payment_status: "FLAGGED_AMOUNT_MISMATCH",
        });
        console.log("[paytr.webhook]", {
          merchant_oid: verification.merchantOrderId,
          status: verification.status,
          amount: incomingAmount,
          previous_state: existing.payment_status,
          new_state: "FLAGGED_AMOUNT_MISMATCH",
          decision: "flagged",
          reason: "amount_mismatch",
        });
        if (strictSignature) {
          return NextResponse.json({ ok: true, status: "flagged" }, { status: 200 });
        }
        return okResponse();
      }
    }

    if (verification.status !== "success") {
      console.log("[paytr.webhook]", {
        merchant_oid: verification.merchantOrderId,
        status: verification.status,
        amount: verification.paymentAmount ?? verification.totalAmount,
        previous_state: existing?.payment_status ?? "none",
        new_state: verification.status,
        decision: "processed",
      });
      await recordOrderStatus({
        merchantOrderId: verification.merchantOrderId,
        orderId: existing?.orderId ?? null,
        eventId: String(eventId),
        splitSlug,
        buyerAddress: verification.buyerAddress ?? null,
        amountTry: String(verification.totalAmount),
        payment_status: verification.status,
      });

      if (strictSignature) {
        return NextResponse.json({ ok: true, status: "recorded" }, { status: 200 });
      }
      return okResponse();
    }

    const result = await processPayment(
      {
        merchantOrderId: verification.merchantOrderId,
        orderId: asHex32(existing?.orderId),
        eventId,
        splitSlug,
        buyerAddress: verification.buyerAddress ?? null,
        amountTry: verification.totalAmount,
      },
      { allowPendingToProcess: true }
    );

    if (result.status === "processed" || result.status === "duplicate") {
      console.log("[paytr.webhook]", {
        merchant_oid: verification.merchantOrderId,
        status: verification.status,
        amount: verification.paymentAmount ?? verification.totalAmount,
        previous_state: existing?.payment_status ?? "none",
        new_state: result.status === "processed" ? "paid" : existing?.payment_status ?? "paid",
        decision: result.status === "processed" ? "processed" : "ignored",
      });
      return okResponse();
    }
    console.log("[paytr.webhook]", {
      merchant_oid: verification.merchantOrderId,
      status: verification.status,
      amount: verification.paymentAmount ?? verification.totalAmount,
      previous_state: existing?.payment_status ?? "none",
      new_state: existing?.payment_status ?? "pending",
      decision: "ignored",
      reason: "pending",
    });
    if (strictSignature) {
      return NextResponse.json({ ok: true, status: "recorded", message: result.message }, { status: 200 });
    }
    return okResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
