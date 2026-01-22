import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAddress, verifyTypedData } from "viem";

import { getOrderByMerchantId } from "@/src/lib/ordersStore";
import { computeOrderId } from "@/src/server/orderId";
import { createRateLimiter } from "@/src/server/rateLimit";

type TicketIntent = {
  buyer: string;
  splitSlug: string;
  merchantOrderId: string;
  eventId: string | number | bigint;
  amountWei: string | number | bigint;
  deadline: string | number | bigint;
};

type IntentPayload = {
  intent?: TicketIntent;
  signature?: string;
};

const INTENT_TYPES = {
  TicketIntent: [
    { name: "buyer", type: "address" },
    { name: "splitSlug", type: "string" },
    { name: "merchantOrderId", type: "string" },
    { name: "eventId", type: "uint256" },
    { name: "amountWei", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const intentLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });

function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

function normalizeBigInt(value: TicketIntent["eventId"]): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error("Invalid numeric value");
}

export async function POST(request: Request) {
  try {
    const rate = intentLimiter(getClientIp(request.headers));
    if (!rate.ok) {
      const retryAfter = Math.ceil(rate.retryAfterMs / 1000);
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const raw = await request.text();
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Empty body" }, { status: 400 });
    }

    let payload: IntentPayload;
    try {
      payload = JSON.parse(raw) as IntentPayload;
    } catch (error) {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const intent = payload.intent;
    const signature = payload.signature;

    if (!intent) {
      return NextResponse.json({ ok: false, error: "Missing intent" }, { status: 400 });
    }

    const buyerRaw = (intent as { buyer?: unknown } | undefined)?.buyer;
    const buyer = typeof buyerRaw === "string" ? buyerRaw : "";

    let buyerChecksum: `0x${string}`;
    try {
      buyerChecksum = getAddress(buyer);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid intent.buyer", buyer: buyerRaw ?? null },
        { status: 400 }
      );
    }
    if (!intent.splitSlug || !intent.merchantOrderId) {
      const paymentIntentId = crypto.randomUUID();
      const orderId = computeOrderId({
        paymentIntentId,
        buyer: buyerChecksum,
        eventId: normalizeBigInt(intent.eventId),
        chainId: 11155111,
      });
      return NextResponse.json({ ok: true, status: "created", paymentIntentId, orderId });
    }

    const vcRaw = process.env.TICKET_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS;
    let verifyingContract: `0x${string}`;
    try {
      verifyingContract = getAddress(String(vcRaw || ""));
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid verifyingContract", verifyingContract: vcRaw ?? null },
        { status: 400 }
      );
    }

    const deadline = normalizeBigInt(intent.deadline);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (deadline < now) {
      return NextResponse.json({ ok: false, error: "Intent expired" }, { status: 400 });
    }

    let verifyingContractChecksum: `0x${string}`;
    try {
      verifyingContractChecksum = getAddress(String(verifyingContract));
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid verifyingContract before verifyTypedData",
          verifyingContract: verifyingContract ?? null,
        },
        { status: 400 }
      );
    }

    const domain = {
      name: "EtkinlikKonser",
      version: "1",
      chainId: 11155111,
      verifyingContract: verifyingContractChecksum,
    } as const;

    let buyerChecksumForMessage: `0x${string}`;
    try {
      buyerChecksumForMessage = getAddress(String(intent.buyer));
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid buyer before verifyTypedData", buyer: intent?.buyer ?? null },
        { status: 400 }
      );
    }

    const message = {
      buyer: buyerChecksumForMessage,
      splitSlug: intent.splitSlug,
      merchantOrderId: intent.merchantOrderId,
      eventId: normalizeBigInt(intent.eventId),
      amountWei: normalizeBigInt(intent.amountWei),
      deadline: normalizeBigInt(intent.deadline),
    } as const;

    console.log("[intent debug] domain =", domain);
    console.log("[intent debug] message =", message);
    console.log("[intent debug] signature? =", typeof signature, signature?.slice?.(0, 10));

    const debug = {
      domainVerifyingContract: (domain as unknown as { verifyingContract?: string })?.verifyingContract,
      messageBuyer: (message as unknown as { buyer?: string })?.buyer,
    };

    if (!debug.domainVerifyingContract || String(debug.domainVerifyingContract) === "undefined") {
      return NextResponse.json(
        { ok: false, error: "domain.verifyingContract is undefined", debug },
        { status: 400 }
      );
    }

    if (!debug.messageBuyer || String(debug.messageBuyer) === "undefined") {
      return NextResponse.json(
        { ok: false, error: "message.buyer is undefined", debug },
        { status: 400 }
      );
    }

    try {
      getAddress(String(debug.domainVerifyingContract));
    } catch {
      return NextResponse.json({ ok: false, error: "domain.verifyingContract invalid", debug }, { status: 400 });
    }
    try {
      getAddress(String(debug.messageBuyer));
    } catch {
      return NextResponse.json({ ok: false, error: "message.buyer invalid", debug }, { status: 400 });
    }

    const paymentIntentId = intent.merchantOrderId;
    const orderId = computeOrderId({
      paymentIntentId,
      buyer: buyerChecksumForMessage,
      eventId: normalizeBigInt(intent.eventId),
      chainId: 11155111,
    });

    if (!signature || !signature.trim()) {
      return NextResponse.json({ ok: true, status: "created", paymentIntentId, orderId });
    }

    const normalizedSig = signature.trim();
    const isHexSig = /^0x[0-9a-fA-F]{130}$/.test(normalizedSig);
    if (!isHexSig) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const verified = await verifyTypedData({
      address: message.buyer,
      domain,
      types: INTENT_TYPES,
      primaryType: "TicketIntent",
      message,
      signature: normalizedSig as `0x${string}`,
    });

    if (!verified) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const existing = await getOrderByMerchantId(paymentIntentId);
    if (existing) {
      if (existing.txHash) {
        return NextResponse.json({ ok: true, status: "duplicate", txHash: existing.txHash, paymentIntentId, orderId });
      }
      return NextResponse.json({ ok: true, status: "duplicate", paymentIntentId, orderId });
    }

    return NextResponse.json({
      ok: true,
      status: "verified",
      paymentIntentId,
      orderId,
    });
  } catch (error) {
    console.error("[/api/tickets/intent] ERROR:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
