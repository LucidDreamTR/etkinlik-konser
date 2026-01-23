import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  encodePacked,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from "viem";

import { EVENTS } from "@/data/events";
import { getDefaultTicketSelection, getTicketTypeConfig } from "@/data/ticketMetadata";
import { getTicketContractAddress } from "@/lib/site";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { getOrderByTokenId } from "@/src/lib/ordersStore";

export const dynamic = "force-dynamic";

const RPC_URL = process.env.ETHEREUM_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID_RAW = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
const CHAIN_ID = Number.isFinite(CHAIN_ID_RAW) ? CHAIN_ID_RAW : 11155111;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseBigIntParam(value: string | null | undefined): bigint | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return trimmed.startsWith("0x") ? BigInt(trimmed) : BigInt(trimmed);
  } catch {
    return null;
  }
}

function resolveEventById(eventIdNumber: number) {
  if (!Number.isFinite(eventIdNumber) || eventIdNumber < 1 || eventIdNumber > EVENTS.length) return null;
  return { event: EVENTS[eventIdNumber - 1], eventIdNumber };
}

function resolveEvent(eventIdParam: string | undefined) {
  const trimmed = eventIdParam?.trim() ?? "";
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && Number.isInteger(numeric) && numeric >= 1 && numeric <= EVENTS.length) {
    return { event: EVENTS[numeric - 1], eventIdNumber: numeric };
  }

  const direct = EVENTS.find((event) => event.slug === trimmed || event.planId === trimmed);
  if (!direct) return null;
  const index = EVENTS.findIndex((event) => event.slug === direct.slug);
  return { event: direct, eventIdNumber: index >= 0 ? index + 1 : 0 };
}

function buildSvg(
  eventName: string,
  dateLabel: string,
  venueLabel: string,
  eventId: number,
  accentColor: string,
  accentLabel: string
) {
  const title = escapeXml(eventName);
  const date = escapeXml(dateLabel);
  const venue = escapeXml(venueLabel);
  const accent = escapeXml(accentColor);
  const label = escapeXml(accentLabel);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="510" rx="32" fill="#0b1220" stroke="#334155" stroke-width="2"/>
  <rect x="94" y="98" width="8" height="434" fill="${accent}"/>
  <rect x="104" y="98" width="260" height="40" rx="20" fill="${accent}" opacity="0.18"/>
  <text x="126" y="126" fill="${accent}" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">${label}</text>
  <text x="110" y="180" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="56" font-weight="700">${title}</text>
  <text x="110" y="260" fill="#94a3b8" font-family="Arial, sans-serif" font-size="32">${date}</text>
  <text x="110" y="320" fill="#94a3b8" font-family="Arial, sans-serif" font-size="28">${venue}</text>
  <text x="110" y="470" fill="${accent}" font-family="Arial, sans-serif" font-size="24">Ticket #${eventId}</text>
  <text x="110" y="510" fill="#64748b" font-family="Arial, sans-serif" font-size="20">Etkinlik & Konser</text>
</svg>
`.trim();
}

async function resolveOnchainTicket(tokenId: bigint) {
  const contractAddress = getTicketContractAddress({ server: true });
  const client = createPublicClient({ transport: http(RPC_URL) });
  const [ticketMeta, paymentId] = await Promise.all([
    client.readContract({
      address: contractAddress,
      abi: eventTicketAbi,
      functionName: "tickets",
      args: [tokenId],
    }) as Promise<readonly [bigint, boolean]>,
    client.readContract({
      address: contractAddress,
      abi: eventTicketAbi,
      functionName: "paymentIdOf",
      args: [tokenId],
    }) as Promise<Hex>,
  ]);
  return {
    eventId: Number(ticketMeta[0]),
    claimed: ticketMeta[1],
    paymentId,
  };
}

async function resolvePaymentPreimageHex(args: {
  tokenId: string;
  onchainPaymentId?: Hex | null;
}): Promise<{ paymentId: Hex | ""; qrHash: string; verified: boolean; source: "preimage" | "onchain" | "none" }> {
  const order = await getOrderByTokenId(args.tokenId);
  let preimageHex: Hex | null = null;

  if (order?.paymentIdPreimage) {
    preimageHex = order.paymentIdPreimage as Hex;
  } else if (order?.buyerAddress && order.orderNonce && order.ticketType) {
    try {
      preimageHex = encodePacked(
        ["uint256", "string", "string", "address", "string"],
        [BigInt(order.eventId), order.ticketType, order.seat ?? "", order.buyerAddress as `0x${string}`, order.orderNonce]
      );
    } catch {
      preimageHex = null;
    }
  }

  const onchainPaymentId = args.onchainPaymentId ?? null;
  const verified = Boolean(preimageHex && onchainPaymentId && keccak256(preimageHex) === onchainPaymentId);
  if (verified && preimageHex) {
    return {
      paymentId: preimageHex,
      qrHash: keccak256(preimageHex),
      verified,
      source: "preimage",
    };
  }
  if (onchainPaymentId) {
    return {
      paymentId: onchainPaymentId,
      qrHash: onchainPaymentId,
      verified,
      source: "onchain",
    };
  }
  return { paymentId: "", qrHash: "", verified: false, source: "none" };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await context.params;
  const fallbackId = new URL(request.url).pathname.split("/").pop() || "";
  const search = request.nextUrl.searchParams;
  const debugEnabled = search.get("debug") === "1";
  const tokenIdParam = search.get("tokenId") ?? search.get("token_id");
  const eventIdParam = search.get("eventId") ?? search.get("event_id");

  const tokenIdCandidate = tokenIdParam ?? (eventIdParam ? null : eventId ?? fallbackId);
  const tokenId = parseBigIntParam(tokenIdCandidate);

  let onchainTicket: Awaited<ReturnType<typeof resolveOnchainTicket>> | null = null;
  let paymentIdOnchain: Hex | null = null;
  let paymentReadError: string | null = null;
  const contractAddressRaw = getTicketContractAddress({ server: true });
  const contractAddressUsed: Address | null =
    contractAddressRaw && isAddress(contractAddressRaw)
      ? (getAddress(contractAddressRaw) as Address)
      : null;
  if (tokenId !== null && contractAddressUsed) {
    try {
      const client = createPublicClient({ transport: http(RPC_URL) });
      const [ticketMeta, paymentId] = await Promise.all([
        client.readContract({
          address: contractAddressUsed,
          abi: eventTicketAbi,
          functionName: "tickets",
          args: [tokenId],
        }) as Promise<readonly [bigint, boolean]>,
        client.readContract({
          address: contractAddressUsed,
          abi: eventTicketAbi,
          functionName: "paymentIdOf",
          args: [tokenId],
        }) as Promise<Hex>,
      ]);
      onchainTicket = {
        eventId: Number(ticketMeta[0]),
        claimed: ticketMeta[1],
        paymentId,
      };
      paymentIdOnchain = paymentId;
    } catch (error) {
      paymentReadError = error instanceof Error ? error.message : String(error);
      onchainTicket = null;
      paymentIdOnchain = null;
    }
  } else if (tokenId !== null && !contractAddressUsed) {
    paymentReadError = "Invalid contract address";
  }

  if (debugEnabled) {
    let paymentIdSource: "preimage" | "onchain" | "none" = "none";
    if (tokenId !== null && paymentIdOnchain) {
      const resolved = await resolvePaymentPreimageHex({
        tokenId: tokenId.toString(),
        onchainPaymentId: paymentIdOnchain,
      });
      paymentIdSource = resolved.source;
    } else if (paymentIdOnchain) {
      paymentIdSource = "onchain";
    }
    return NextResponse.json({
      rpcUrlPresent: Boolean(RPC_URL),
      chainIdUsed: CHAIN_ID,
      contractAddressUsed: contractAddressRaw ?? null,
      tokenIdParsed: tokenId !== null ? tokenId.toString() : null,
      paymentIdOnchain: paymentIdOnchain ?? null,
      paymentIdSource,
      error: paymentReadError,
    });
  }

  const resolved =
    onchainTicket?.eventId
      ? resolveEventById(onchainTicket.eventId)
      : resolveEvent(eventIdParam ?? eventId ?? fallbackId);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
  }

  const { event, eventIdNumber } = resolved;
  const venue = event.venueName ?? event.location ?? "TBA";
  const date = event.date ?? event.dateLabel ?? "TBA";
  const displayId =
    tokenId !== null && tokenId <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(tokenId) : eventIdNumber;
  const order = tokenId ? await getOrderByTokenId(tokenId.toString()) : null;
  const defaultSelection = getDefaultTicketSelection(eventIdNumber);
  const ticketType = normalizeString(order?.ticketType) ?? defaultSelection.ticketType;
  const seatValue = normalizeString(order?.seat) ?? defaultSelection.seat;
  const ticketConfig = getTicketTypeConfig(eventIdNumber, ticketType);
  const svg = buildSvg(event.title, date, venue, displayId, ticketConfig.accent, ticketConfig.label);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  const payment = tokenId
    ? await resolvePaymentPreimageHex({
        tokenId: tokenId.toString(),
        onchainPaymentId: paymentIdOnchain ?? null,
      })
    : { paymentId: "", qrHash: "", verified: false };

  const paymentIdFallback = paymentIdOnchain ?? onchainTicket?.paymentId ?? "";
  const paymentIdValue = payment.paymentId || paymentIdFallback;
  const qrHashValue = paymentIdValue ? (payment.paymentId ? payment.qrHash : paymentIdValue) : "";

  const seatLabel = seatValue ? ` ${seatValue}` : "";
  const description = ticketConfig.label
    ? `${ticketConfig.label}${event.title ? ` — ${event.title}` : ""}`
    : event.description ?? "Event ticket";
  const body = {
    name: `${event.title} — ${ticketConfig.ticketType}${seatLabel}`,
    description,
    image,
    attributes: [
      { trait_type: "EventId", value: eventIdNumber.toString() },
      { trait_type: "EventSlug", value: event.slug },
      { trait_type: "TicketType", value: ticketConfig.ticketType },
      ...(seatValue ? [{ trait_type: "Seat", value: seatValue }] : []),
      { trait_type: "PaymentId", value: paymentIdValue },
      { trait_type: "QRHash", value: qrHashValue },
      { trait_type: "ChainId", value: CHAIN_ID.toString() },
    ],
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
