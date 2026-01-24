import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";

import { getTicketContractAddress } from "@/lib/site";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { getOrderByTokenId, markTokenUsedOnce } from "@/src/lib/ordersStore";
import { hashPaymentPreimage } from "@/src/lib/paymentHash";
import { shouldIncludeGateDebug } from "@/src/server/debugFlags";
import { createRateLimiter } from "@/src/server/rateLimit";

const verifyLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });
const RPC_URL = process.env.ETHEREUM_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID_RAW = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
const CHAIN_ID = Number.isFinite(CHAIN_ID_RAW) ? CHAIN_ID_RAW : 11155111;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const debugEnabled = shouldIncludeGateDebug();

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
  // QR code content === payment preimage; expectedHash = keccak256(preimage).
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
    console.info("gate.verify.fail.onchain_error", {
      tokenId: tokenId.toString(),
      chainId: CHAIN_ID,
    });
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
    console.info("gate.verify.fail.not_claimed", {
      tokenId: tokenId.toString(),
      eventId,
      chainId: CHAIN_ID,
    });
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
    console.info("gate.verify.fail.payment_missing", {
      tokenId: tokenId.toString(),
      eventId,
      chainId: CHAIN_ID,
    });
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
  try {
    expectedHash = hashPaymentPreimage(code).toLowerCase();
  } catch {
    expectedHash = null;
  }

  if (!expectedHash) {
    console.info("gate.verify.fail.invalid_code", {
      tokenId: tokenId.toString(),
      eventId,
      chainId: CHAIN_ID,
    });
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
    console.info("gate.verify.fail.payment_mismatch", {
      tokenId: tokenId.toString(),
      eventId,
      chainId: CHAIN_ID,
    });
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

  const order = await getOrderByTokenId(tokenId.toString());
  if (order?.claimedTo && owner) {
    try {
      const claimedTo = getAddress(order.claimedTo);
      if (claimedTo !== owner) {
        console.info("gate.verify.fail.not_owner", {
          tokenId: tokenId.toString(),
          eventId,
          chainId: CHAIN_ID,
        });
        return NextResponse.json({
          ok: true,
          valid: false,
          reason: "not_owner",
          details: "Owner does not match claimed address",
          chainId: CHAIN_ID,
          tokenId: tokenId.toString(),
          owner,
          eventId,
          claimed,
        });
      }
    } catch {
      // If stored claimedTo is invalid, skip owner check to avoid false negatives.
    }
  }

  const useResult = await markTokenUsedOnce({
    tokenId: tokenId.toString(),
    owner,
    eventId,
  });
  if (useResult.alreadyUsed) {
    console.info("gate.verify.fail.already_used", {
      tokenId: tokenId.toString(),
      eventId,
      chainId: CHAIN_ID,
    });
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: "already_used",
      details: "Ticket already used",
      chainId: CHAIN_ID,
      tokenId: tokenId.toString(),
      owner,
      eventId,
      claimed,
    });
  }

  console.info("gate.verify.success", {
    tokenId: tokenId.toString(),
    eventId,
    chainId: CHAIN_ID,
  });

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
