import { NextResponse } from "next/server";
import { getAddress, verifyTypedData } from "viem";

import { getOrderByMerchantId, recordPaidOrder } from "@/src/lib/ordersStore";
import { computeOrderId } from "@/src/server/orderId";
import { purchaseOnchain } from "@/src/server/onchainPurchase";

type TicketIntent = {
  buyer: string;
  splitSlug: string;
  merchantOrderId: string;
  eventId: string | number | bigint;
  amountWei: string | number | bigint;
  deadline: string | number | bigint;
};

type PurchasePayload = {
  intent?: TicketIntent;
  signature?: string;
  intentId?: string;
  merchantOrderId?: string;
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

function normalizeBigInt(value: TicketIntent["eventId"]): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error("Invalid numeric value");
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Empty body" }, { status: 400 });
    }

    let payload: PurchasePayload;
    try {
      payload = JSON.parse(raw) as PurchasePayload;
    } catch (error) {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const intent = payload.intent;
    const signature = payload.signature;

    if (!intent) {
      if (payload.intentId || payload.merchantOrderId) {
        return NextResponse.json(
          { ok: false, error: "Purchase requires intent payload and signature" },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: false, error: "Missing intent" }, { status: 400 });
    }

    if (!signature || !signature.trim()) {
      return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
    }
    const normalizedSig = signature.trim();
    if (!/^0x[0-9a-fA-F]{130}$/.test(normalizedSig)) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    let buyerChecksumForMessage: `0x${string}`;
    try {
      buyerChecksumForMessage = getAddress(String(intent.buyer));
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid buyer before verifyTypedData", buyer: intent?.buyer ?? null },
        { status: 400 }
      );
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

    const domain = {
      name: "EtkinlikKonser",
      version: "1",
      chainId: 11155111,
      verifyingContract,
    } as const;

    const message = {
      buyer: buyerChecksumForMessage,
      splitSlug: intent.splitSlug,
      merchantOrderId: intent.merchantOrderId,
      eventId: normalizeBigInt(intent.eventId),
      amountWei: normalizeBigInt(intent.amountWei),
      deadline: normalizeBigInt(intent.deadline),
    } as const;

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

    const paymentIntentId = intent.merchantOrderId;
    const eventIdNormalized = normalizeBigInt(intent.eventId);
    const orderId = computeOrderId({
      paymentIntentId,
      buyer: buyerChecksumForMessage,
      eventId: eventIdNormalized,
      chainId: 11155111,
    });

    const existing = await getOrderByMerchantId(paymentIntentId);
    if (existing) {
      if (existing.txHash) {
        return NextResponse.json({ ok: true, status: "duplicate", txHash: existing.txHash, paymentIntentId, orderId });
      }
      return NextResponse.json({ ok: true, status: "duplicate", paymentIntentId, orderId });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const tokenUri = `${appUrl}/api/metadata/ticket/${eventIdNormalized.toString()}`;
    if (!tokenUri) {
      return NextResponse.json({ ok: false, error: "Missing tokenUri" }, { status: 400 });
    }

    const onchain = await purchaseOnchain({
      orderId,
      splitSlug: intent.splitSlug,
      eventId: intent.eventId,
      amountTry: intent.amountWei.toString(),
      amountWei: intent.amountWei,
      buyerAddress: buyerChecksumForMessage,
      uri: tokenUri,
    });

    if ("alreadyUsed" in onchain && onchain.alreadyUsed) {
      return NextResponse.json({ ok: true, status: "duplicate", paymentIntentId, orderId });
    }

    await recordPaidOrder({
      merchantOrderId: paymentIntentId,
      orderId,
      splitSlug: intent.splitSlug,
      eventId: intent.eventId.toString(),
      amountTry: intent.amountWei.toString(),
      buyerAddress: buyerChecksumForMessage,
      txHash: onchain.txHash,
      tokenId: onchain.tokenId,
      nftAddress: onchain.nftAddress,
      custodyAddress: null,
      intentSignature: signature,
      intentDeadline: intent.deadline.toString(),
      intentAmountWei: intent.amountWei.toString(),
      claimCodeHash: null,
      claimStatus: "claimed",
      claimedTo: buyerChecksumForMessage,
      claimedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      status: "processed",
      txHash: onchain.txHash,
      paymentIntentId,
      orderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
