import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";

import { getTicketContractAddress } from "@/lib/site";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { hashPaymentPreimage } from "@/src/lib/paymentHash";
import { createRateLimiter } from "@/src/server/rateLimit";

const verifyLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });
const RPC_URL = process.env.ETHEREUM_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID_RAW = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
const CHAIN_ID = Number.isFinite(CHAIN_ID_RAW) ? CHAIN_ID_RAW : 11155111;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const debugEnabled = process.env.GATE_VERIFY_DEBUG === "true";

type VerifyPayload = {
  tokenId?: string | number;
  code?: string;
};

function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

function parseTokenId(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return BigInt(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return trimmed.startsWith("0x") ? BigInt(trimmed) : BigInt(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  const rate = verifyLimiter(getClientIp(request.headers));
  if (!rate.ok) {
    const retryAfter = Math.ceil(rate.retryAfterMs / 1000);
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let payload: VerifyPayload;
  try {
    payload = (await request.json()) as VerifyPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const tokenId = parseTokenId(payload?.tokenId);
  if (tokenId === null) {
    return NextResponse.json({ ok: false, error: "Invalid tokenId" }, { status: 400 });
  }

  const code = normalizeCode(payload?.code);
  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }

  const contractAddressRaw = getTicketContractAddress({ server: true });
  const contractAddress = isAddress(contractAddressRaw) ? (getAddress(contractAddressRaw) as `0x${string}`) : null;
  if (!contractAddress) {
    return NextResponse.json({ ok: true, valid: false, reason: "onchain_error", details: "Invalid contract address", chainId: CHAIN_ID, tokenId: tokenId.toString() });
  }

  const client = createPublicClient({ transport: http(RPC_URL) });

  let owner: string | null = null;
  let claimed = false;
  let eventId: string | null = null;
  let paymentIdOnchain: string | null = null;

  try {
    const [ownerRaw, ticketMeta, paymentId] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: eventTicketAbi,
        functionName: "ownerOf",
        args: [tokenId],
      }) as Promise<`0x${string}`>,
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
      }) as Promise<`0x${string}`>,
    ]);

    owner = getAddress(ownerRaw);
    eventId = ticketMeta[0].toString();
    claimed = Boolean(ticketMeta[1]);
    paymentIdOnchain = paymentId.toLowerCase();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: "onchain_error",
      details: message,
      chainId: CHAIN_ID,
      tokenId: tokenId.toString(),
    });
  }

  if (!claimed) {
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: "not_claimed",
      details: "Ticket not claimed",
      chainId: CHAIN_ID,
      tokenId: tokenId.toString(),
      owner,
      eventId,
      claimed,
      ...(debugEnabled ? { paymentIdOnchain } : {}),
    });
  }

  if (!paymentIdOnchain || paymentIdOnchain === ZERO_BYTES32) {
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: "payment_missing",
      details: "Missing paymentId onchain",
      chainId: CHAIN_ID,
      tokenId: tokenId.toString(),
      owner,
      eventId,
      claimed,
      ...(debugEnabled ? { paymentIdOnchain } : {}),
    });
  }

  let expectedHash: string | null = null;
  if (/^0x[0-9a-fA-F]{64}$/.test(code)) {
    expectedHash = code.toLowerCase();
  } else {
    try {
      expectedHash = hashPaymentPreimage(code).toLowerCase();
    } catch {
      expectedHash = null;
    }
  }

  if (!expectedHash) {
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: "invalid_code",
      details: "Invalid code",
      chainId: CHAIN_ID,
      tokenId: tokenId.toString(),
      owner,
      eventId,
      claimed,
      ...(debugEnabled ? { paymentIdOnchain } : {}),
    });
  }

  if (expectedHash !== paymentIdOnchain) {
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: "payment_mismatch",
      details: "Payment hash does not match",
      chainId: CHAIN_ID,
      tokenId: tokenId.toString(),
      owner,
      eventId,
      claimed,
      ...(debugEnabled ? { paymentIdOnchain, expectedHash } : {}),
    });
  }

  return NextResponse.json({
    ok: true,
    valid: true,
    reason: "valid",
    chainId: CHAIN_ID,
    tokenId: tokenId.toString(),
    owner,
    eventId,
    claimed,
    ...(debugEnabled ? { paymentIdOnchain, expectedHash } : {}),
  });
}
