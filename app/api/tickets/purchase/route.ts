import { kv } from "@vercel/kv";
import { createPublicClient, encodePacked, getAddress, http, recoverTypedDataAddress, verifyTypedData } from "viem";

import { getPublicBaseUrl, getTicketContractAddress } from "@/lib/site";
import { getTicketTypeConfig } from "@/data/ticketMetadata";
import { getOrderByMerchantId, recordPaidOrder } from "@/src/lib/ordersStore";
import { hashPaymentPreimage } from "@/src/lib/paymentHash";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { purchaseOnchain } from "@/src/server/onchainPurchase";
import { getServerEnv } from "@/src/lib/env";
import { jsonNoStore } from "@/src/lib/http";
import { emitMetric } from "@/src/lib/metrics";
import { getChainConfig } from "@/src/lib/chain";
import { logger } from "@/src/lib/logger";
import { isProdDebugEnabled } from "@/src/lib/debug";
import { createRateLimiter } from "@/src/server/rateLimit";

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

const env = getServerEnv();
const chain = getChainConfig();
const RPC_URL = chain.rpcUrl;
const debugEnabled = isProdDebugEnabled();
const PURCHASE_LOCK_TTL_SECONDS = 120;
const hasKv = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
const purchaseLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });

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
  const clientIp = getClientIp(request.headers);
  const startedAt = Date.now();
  let lockKey: string | null = null;
  try {
    if (env.VERCEL_ENV === "production" && !env.FEATURE_TICKETING_ENABLED) {
      return jsonNoStore(
        { ok: false, error: "Ticketing temporarily disabled" },
        { status: 503 }
      );
    }

    const rate = purchaseLimiter(clientIp);
    if (!rate.ok) {
      const retryAfter = Math.ceil(rate.retryAfterMs / 1000);
      emitMetric(
        "rate_limit_hit",
        { route: "/api/tickets/purchase", ip: clientIp, reason: "rate_limited" },
        Date.now() - startedAt
      );
      return jsonNoStore(
        { ok: false, error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    if (!env.BACKEND_WALLET_PRIVATE_KEY) {
      return jsonNoStore(
        {
          ok: false,
          error: "Missing env: BACKEND_WALLET_PRIVATE_KEY (server-only, required for minting)",
        },
        { status: 500 }
      );
    }

    const raw = await request.text();
    if (!raw) {
      return jsonNoStore({ ok: false, error: "Empty body" }, { status: 400 });
    }

    let payload: PurchasePayload;
    try {
      payload = JSON.parse(raw) as PurchasePayload;
    } catch (error) {
      return jsonNoStore({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const intent = payload.intent;
    const signature = payload.signature;

    if (!intent) {
      if (payload.intentId || payload.merchantOrderId) {
        return jsonNoStore(
          { ok: false, error: "Purchase requires intent payload and signature" },
          { status: 400 }
        );
      }
      return jsonNoStore({ ok: false, error: "Missing intent" }, { status: 400 });
    }

    if (!signature || !signature.trim()) {
      return jsonNoStore({ ok: false, error: "Missing signature" }, { status: 400 });
    }
    const normalizedSig = signature.trim();
    if (!/^0x[0-9a-fA-F]{130}$/.test(normalizedSig)) {
      return jsonNoStore({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    let buyerChecksumForMessage: `0x${string}`;
    try {
      buyerChecksumForMessage = getAddress(String(intent.buyer));
    } catch {
      return jsonNoStore({ ok: false, error: "Invalid buyer before verifyTypedData" }, { status: 400 });
    }

    let verifyingContract: `0x${string}`;
    try {
      verifyingContract = getTicketContractAddress({ server: true });
    } catch {
      return jsonNoStore({ ok: false, error: "Invalid verifyingContract" }, { status: 400 });
    }

    const domain = {
      name: "EtkinlikKonser",
      version: "1",
      chainId: chain.chainId,
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
      let recoveredSigner: string | null = null;
      if (debugEnabled) {
        try {
          recoveredSigner = await recoverTypedDataAddress({
            domain,
            types: INTENT_TYPES,
            primaryType: "TicketIntent",
            message,
            signature: normalizedSig as `0x${string}`,
          });
        } catch {
          recoveredSigner = null;
        }
      }
      return jsonNoStore(
        {
          ok: false,
          error: "Invalid signature",
          ...(debugEnabled ? { recoveredSigner, expectedBuyer: message.buyer } : {}),
        },
        { status: 401 }
      );
    }

    const paymentIntentId = intent.merchantOrderId;
    const eventIdNormalized = normalizeBigInt(intent.eventId);
    const eventIdNumber = Number(eventIdNormalized);
    if (!Number.isFinite(eventIdNumber)) {
      return jsonNoStore({ ok: false, error: "Invalid eventId" }, { status: 400 });
    }
    const ticketTypeRaw = normalizeString(intent.ticketType);
    const seatRaw = normalizeString(intent.seat);
    const selection = resolveTicketSelection(eventIdNumber, ticketTypeRaw, seatRaw);
    const orderNonce = paymentIntentId;
    const paymentPreimage = encodePacked(
      ["uint256", "string", "string", "address", "string"],
      [eventIdNormalized, selection.ticketType, selection.seat ?? "", buyerChecksumForMessage, orderNonce]
    );
    const orderId = hashPaymentPreimage(paymentPreimage);

    const existing = await getOrderByMerchantId(paymentIntentId);
    if (existing?.txHash) {
      if (debugEnabled) {
        logger.info("purchase.duplicate", {
          merchantOrderId: paymentIntentId,
          orderId,
          txHash: existing.txHash,
          tokenId: existing.tokenId ?? null,
        });
      }
      emitMetric(
        "purchase_duplicate",
        { route: "/api/tickets/purchase", merchantOrderId: paymentIntentId, ip: clientIp },
        Date.now() - startedAt
      );
      return jsonNoStore({
        ok: true,
        status: "duplicate",
        txHash: existing.txHash,
        paymentIntentId,
        orderId,
        ...(debugEnabled ? { existingHadTxHash: true, lockHit: false } : {}),
      });
    }
    // NOTE: existing record without txHash is a pending intent -> continue processing.

    if (hasKv) {
      lockKey = `purchase:lock:${paymentIntentId}`;
      const acquired = await kv.set(lockKey, "1", { nx: true, ex: PURCHASE_LOCK_TTL_SECONDS });
      if (!acquired) {
        if (debugEnabled) {
          logger.info("purchase.pending", { merchantOrderId: paymentIntentId, orderId });
        }
        emitMetric(
          "lock_hit",
          { route: "/api/tickets/purchase", merchantOrderId: paymentIntentId, ip: clientIp },
          Date.now() - startedAt
        );
        emitMetric(
          "purchase_pending",
          { route: "/api/tickets/purchase", merchantOrderId: paymentIntentId, ip: clientIp },
          Date.now() - startedAt
        );
        return jsonNoStore({
          ok: true,
          status: "pending",
          paymentIntentId,
          orderId,
          ...(debugEnabled ? { existingHadTxHash: false, lockHit: true } : {}),
        });
      }
    }

    const appUrl = getPublicBaseUrl();
    let nextTokenId: bigint;
    try {
      nextTokenId = await resolveNextTokenId();
    } catch {
      return jsonNoStore({ ok: false, error: "Failed to read nextTokenId()" }, { status: 500 });
    }
    const tokenUri = `${appUrl}/api/metadata/ticket/${eventIdNormalized.toString()}?tokenId=${nextTokenId.toString()}`;

    let onchain: Awaited<ReturnType<typeof purchaseOnchain>>;
    try {
      onchain = await purchaseOnchain({
        orderId,
        splitSlug: intent.splitSlug,
        eventId: intent.eventId,
        amountTry: intent.amountWei.toString(),
        amountWei: intent.amountWei,
        buyerAddress: buyerChecksumForMessage,
        uri: tokenUri,
      });
    } catch (error) {
      const err = error as Error & { stage?: string; rpcErrorCode?: unknown };
      if (lockKey) {
        await kv.del(lockKey).catch(() => {});
      }
      return jsonNoStore(
        {
          ok: false,
          error: err.message || "Onchain error",
          ...(debugEnabled
            ? {
                txStage: err.stage ?? null,
                rpcErrorCode: err.rpcErrorCode ?? null,
              }
            : {}),
        },
        { status: 500 }
      );
    }

    if ("alreadyUsed" in onchain && onchain.alreadyUsed) {
      if (lockKey) {
        await kv.del(lockKey).catch(() => {});
      }
      emitMetric(
        "purchase_duplicate",
        { route: "/api/tickets/purchase", merchantOrderId: paymentIntentId, ip: clientIp },
        Date.now() - startedAt
      );
      return jsonNoStore({
        ok: true,
        status: "duplicate",
        paymentIntentId,
        orderId,
        ...(debugEnabled ? { existingHadTxHash: false, lockHit: false } : {}),
      });
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

    if (debugEnabled) {
      logger.info("purchase.processed", {
        merchantOrderId: paymentIntentId,
        orderId,
        txHash: onchain.txHash,
        tokenId: onchain.tokenId ?? null,
      });
    }
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    emitMetric(
      "purchase_processed",
      { route: "/api/tickets/purchase", merchantOrderId: paymentIntentId, ip: clientIp },
      Date.now() - startedAt
    );
    return jsonNoStore({
      ok: true,
      status: "processed",
      txHash: onchain.txHash,
      paymentIntentId,
      orderId,
      ...(debugEnabled ? { existingHadTxHash: false, lockHit: false } : {}),
    });
  } catch (error) {
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    const message = error instanceof Error ? error.message : String(error);
    return jsonNoStore({ ok: false, error: message }, { status: 500 });
  }
}
