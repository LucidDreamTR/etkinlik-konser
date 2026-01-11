import { NextResponse } from "next/server";

import { EVENTS } from "@/data/events";
import { validateServerEnv } from "@/src/server/env";
import { processPayment } from "@/src/server/payments";

type FakePayPayload = {
  merchantOrderId?: string;
  eventId?: string | number | bigint;
  splitSlug?: string;
  buyerAddress?: string | null;
  amountTry?: string | number | bigint;
  amountWei?: string | number | bigint;
};

export async function POST(request: Request) {
  try {
    validateServerEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid server env";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  let payload: FakePayPayload;
  try {
    payload = (await request.json()) as FakePayPayload;
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof payload?.merchantOrderId !== "string" || !payload.merchantOrderId.trim()) {
    return NextResponse.json({ ok: false, error: "Missing merchantOrderId" }, { status: 400 });
  }

  const defaultEvent = EVENTS[0];
  if (!defaultEvent) {
    return NextResponse.json({ ok: false, error: "No events available" }, { status: 500 });
  }

  const eventId = payload.eventId ?? 1;
  const splitSlug = payload.splitSlug ?? defaultEvent.planId ?? defaultEvent.slug;
  const amountTry = payload.amountTry ?? 1;

  try {
    const result = await processPayment({
      merchantOrderId: payload.merchantOrderId,
      eventId,
      splitSlug,
      buyerAddress: payload.buyerAddress ?? null,
      amountTry,
      amountWei: payload.amountWei,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
