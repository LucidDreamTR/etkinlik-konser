import { NextResponse } from "next/server";
import { createPublicClient, encodePacked, getAddress, http, keccak256, verifyTypedData } from "viem";

import { getPublicBaseUrl, getTicketContractAddress } from "@/lib/site";
import { getTicketTypeConfig } from "@/data/ticketMetadata";
import { getOrderByMerchantId, recordPaidOrder } from "@/src/lib/ordersStore";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { purchaseOnchain } from "@/src/server/onchainPurchase";

type TicketIntent = {
  buyer: string;
  splitSlug: string;
  merchantOrderId: string;
  eventId: string | number | bigint;
  amountWei: string | number | bigint;
  deadline: string | number | bigint;
  ticketType?: string;
  seat?: string | null;
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

const RPC_URL = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

function normalizeBigInt(value: TicketIntent["eventId"]): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error("Invalid numeric value");
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveTicketSelection(eventIdNumber: number, ticketTypeRaw: string | null, seatRaw: string | null) {
  const ticketConfig = getTicketTypeConfig(eventIdNumber, ticketTypeRaw);
  const seats = ticketConfig.seats ?? [];
  let resolvedSeat: string | null = null;
  if (seatRaw && seats.length > 0) {
    const match = seats.find((seat) => seat.toLowerCase() === seatRaw.toLowerCase());
    resolvedSeat = match ?? seats[0] ?? null;
  } else if (!seatRaw && seats.length > 0) {
    resolvedSeat = seats[0] ?? null;
  }
  return {
    ticketType: ticketConfig.ticketType,
    seat: resolvedSeat,
  };
}

async function resolveNextTokenId(): Promise<bigint> {
  const contractAddress = getTicketContractAddress({ server: true });
  const client = createPublicClient({ transport: http(RPC_URL) });
  return (await client.readContract({
    address: contractAddress,
    abi: eventTicketAbi,
    functionName: "nextTokenId",
    args: [],
  })) as bigint;
}

export async function POST(request: Request) {
  try {
    if (!process.env.BACKEND_WALLET_PRIVATE_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing env: BACKEND_WALLET_PRIVATE_KEY (server-only, required for minting)",
        },
        { status: 500 }
      );
    }

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

    let verifyingContract: `0x${string}`;
    try {
      verifyingContract = getTicketContractAddress({ server: true });
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid verifyingContract", verifyingContract: null },
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
    const eventIdNumber = Number(eventIdNormalized);
    if (!Number.isFinite(eventIdNumber)) {
      return NextResponse.json({ ok: false, error: "Invalid eventId" }, { status: 400 });
    }
    const ticketTypeRaw = normalizeString(intent.ticketType);
    const seatRaw = normalizeString(intent.seat);
    const selection = resolveTicketSelection(eventIdNumber, ticketTypeRaw, seatRaw);
    const orderNonce = paymentIntentId;
    const paymentPreimage = encodePacked(
      ["uint256", "string", "string", "address", "string"],
      [eventIdNormalized, selection.ticketType, selection.seat ?? "", buyerChecksumForMessage, orderNonce]
    );
    const orderId = keccak256(paymentPreimage);

    const existing = await getOrderByMerchantId(paymentIntentId);
    if (existing) {
      if (existing.txHash) {
        return NextResponse.json({ ok: true, status: "duplicate", txHash: existing.txHash, paymentIntentId, orderId });
      }
      return NextResponse.json({ ok: true, status: "duplicate", paymentIntentId, orderId });
    }

    const appUrl = getPublicBaseUrl();
    let nextTokenId: bigint;
    try {
      nextTokenId = await resolveNextTokenId();
    } catch {
      return NextResponse.json({ ok: false, error: "Failed to read nextTokenId()" }, { status: 500 });
    }
    const tokenUri = `${appUrl}/api/metadata/ticket/${eventIdNormalized.toString()}?tokenId=${nextTokenId.toString()}`;

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
      orderNonce,
      splitSlug: intent.splitSlug,
      eventId: intent.eventId.toString(),
      amountTry: intent.amountWei.toString(),
      buyerAddress: buyerChecksumForMessage,
      ticketType: selection.ticketType,
      seat: selection.seat,
      paymentPreimage,
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
