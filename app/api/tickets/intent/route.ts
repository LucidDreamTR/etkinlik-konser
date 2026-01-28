import crypto from "node:crypto";
import { getAddress, verifyTypedData } from "viem";
import { kv } from "@vercel/kv";

import { EVENTS } from "@/data/events";
import { getOrderByMerchantId, recordOrderStatus } from "@/src/lib/ordersStore";
import { computeOrderId } from "@/src/server/orderId";
import { createRateLimiter } from "@/src/server/rateLimit";
import { getTicketContractAddress } from "@/lib/site";
import { getServerEnv } from "@/src/lib/env";
import { jsonNoStore } from "@/src/lib/http";
import { emitMetric } from "@/src/lib/metrics";
import { getChainConfig } from "@/src/lib/chain";
import { logger } from "@/src/lib/logger";
import { isProdDebugEnabled } from "@/src/lib/debug";

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
const INTENT_LOCK_TTL_SECONDS = 60;
const env = getServerEnv();
const chain = getChainConfig();
const debugEnabled = isProdDebugEnabled();
const allowUnsignedIntent = env.ALLOW_UNSIGNED_INTENT;
const isLocalDev = process.env.NODE_ENV === "development" && !process.env.VERCEL_ENV;
// In production, signature is always required even if ALLOW_UNSIGNED_INTENT is set.
const shouldAllowUnsignedIntent = env.VERCEL_ENV !== "production" && (allowUnsignedIntent || isLocalDev);
const hasKv = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

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
  const route = "/api/tickets/intent";
  const clientIp = getClientIp(request.headers);
  const startedAt = Date.now();
  let lockKey: string | null = null;
  try {
    const rate = intentLimiter(`${route}:${clientIp}`);
    if (!rate.ok) {
      const retryAfter = Math.ceil(rate.retryAfterMs / 1000);
      emitMetric(
        "rate_limit_hit",
        { route, ip: clientIp, reason: "rate_limit", latencyMs: Date.now() - startedAt }
      );
      return jsonNoStore(
        { ok: false, error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const raw = await request.text();
    if (!raw) {
      return jsonNoStore({ ok: false, error: "Empty body" }, { status: 400 });
    }

    let payload: IntentPayload;
    try {
      payload = JSON.parse(raw) as IntentPayload;
    } catch (error) {
      return jsonNoStore({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const intent = payload.intent;
    const signature = payload.signature;

    if (!intent) {
      return jsonNoStore({ ok: false, error: "Missing intent" }, { status: 400 });
    }

    const buyerRaw = (intent as { buyer?: unknown } | undefined)?.buyer;
    const buyer = typeof buyerRaw === "string" ? buyerRaw : "";

    let buyerChecksum: `0x${string}`;
    try {
      buyerChecksum = getAddress(buyer);
    } catch {
      return jsonNoStore(
        { ok: false, error: "Invalid intent.buyer", buyer: buyerRaw ?? null },
        { status: 400 }
      );
    }
    const defaultEvent = EVENTS[0];
    const splitSlug = intent.splitSlug ?? defaultEvent?.splitId ?? defaultEvent?.planId ?? defaultEvent?.slug ?? "";
    if (!intent.splitSlug || !intent.merchantOrderId) {
      if (!shouldAllowUnsignedIntent) {
        return jsonNoStore({ ok: false, error: "Signature required" }, { status: 401 });
      }
      const paymentIntentId = intent.merchantOrderId?.trim() || crypto.randomUUID();
      const orderId = computeOrderId({
        paymentIntentId,
        buyer: buyerChecksum,
        eventId: normalizeBigInt(intent.eventId),
        chainId: chain.chainId,
      });

      if (hasKv) {
        lockKey = `intent:lock:${paymentIntentId}`;
        const acquired = await kv.set(lockKey, "1", { nx: true, ex: INTENT_LOCK_TTL_SECONDS });
        if (!acquired) {
          emitMetric(
            "lock_hit",
            {
              route,
              merchantOrderId: paymentIntentId,
              ip: clientIp,
              reason: "lock",
              latencyMs: Date.now() - startedAt,
            }
          );
          return jsonNoStore(
            { ok: true, status: "pending", paymentIntentId, orderId },
            { status: 202 }
          );
        }
      }

      const existing = await getOrderByMerchantId(paymentIntentId);
      if (!existing) {
        await recordOrderStatus({
          merchantOrderId: paymentIntentId,
          orderId,
          eventId: intent.eventId.toString(),
          splitSlug,
          buyerAddress: buyerChecksum,
          amountTry: intent.amountWei?.toString?.() ?? "0",
          intentAmountWei: intent.amountWei?.toString?.() ?? "0",
          intentDeadline: intent.deadline?.toString?.() ?? "",
          payment_status: "pending",
        });
      }
      if (lockKey) {
        await kv.del(lockKey).catch(() => {});
      }
      return jsonNoStore({ ok: true, status: existing ? "duplicate" : "created", paymentIntentId, orderId });
    }

    let verifyingContract: `0x${string}`;
    try {
      verifyingContract = getTicketContractAddress({ server: true });
    } catch {
      return jsonNoStore({ ok: false, error: "Invalid verifyingContract" }, { status: 400 });
    }

    const deadline = normalizeBigInt(intent.deadline);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (deadline < now) {
      return jsonNoStore({ ok: false, error: "Intent expired" }, { status: 400 });
    }

    const domain = {
      name: "EtkinlikKonser",
      version: "1",
      chainId: chain.chainId,
      verifyingContract,
    } as const;

    let buyerChecksumForMessage: `0x${string}`;
    try {
      buyerChecksumForMessage = getAddress(String(intent.buyer));
    } catch {
      return jsonNoStore({ ok: false, error: "Invalid buyer before verifyTypedData" }, { status: 400 });
    }

    const message = {
      buyer: buyerChecksumForMessage,
      splitSlug: intent.splitSlug,
      merchantOrderId: intent.merchantOrderId,
      eventId: normalizeBigInt(intent.eventId),
      amountWei: normalizeBigInt(intent.amountWei),
      deadline: normalizeBigInt(intent.deadline),
    } as const;

    if (debugEnabled) {
      logger.info("intent.debug", {
        domain,
        message: { buyer: message.buyer, merchantOrderId: message.merchantOrderId },
      });
    }

    const debug = {
      domainVerifyingContract: (domain as unknown as { verifyingContract?: string })?.verifyingContract,
      messageBuyer: (message as unknown as { buyer?: string })?.buyer,
    };

    if (!debug.domainVerifyingContract || String(debug.domainVerifyingContract) === "undefined") {
      return jsonNoStore(
        { ok: false, error: "domain.verifyingContract is undefined", ...(debugEnabled ? { debug } : {}) },
        { status: 400 }
      );
    }

    if (!debug.messageBuyer || String(debug.messageBuyer) === "undefined") {
      return jsonNoStore(
        { ok: false, error: "message.buyer is undefined", ...(debugEnabled ? { debug } : {}) },
        { status: 400 }
      );
    }

    try {
      getAddress(String(debug.domainVerifyingContract));
    } catch {
      return jsonNoStore(
        { ok: false, error: "domain.verifyingContract invalid", ...(debugEnabled ? { debug } : {}) },
        { status: 400 }
      );
    }
    try {
      getAddress(String(debug.messageBuyer));
    } catch {
      return jsonNoStore(
        { ok: false, error: "message.buyer invalid", ...(debugEnabled ? { debug } : {}) },
        { status: 400 }
      );
    }

    const paymentIntentId = intent.merchantOrderId;
    const orderId = computeOrderId({
      paymentIntentId,
      buyer: buyerChecksumForMessage,
      eventId: normalizeBigInt(intent.eventId),
      chainId: chain.chainId,
    });

    if (hasKv && !lockKey) {
      lockKey = `intent:lock:${paymentIntentId}`;
      const acquired = await kv.set(lockKey, "1", { nx: true, ex: INTENT_LOCK_TTL_SECONDS });
      if (!acquired) {
        emitMetric(
          "lock_hit",
          {
            route,
            merchantOrderId: paymentIntentId,
            ip: clientIp,
            reason: "lock",
            latencyMs: Date.now() - startedAt,
          }
        );
        return jsonNoStore({ ok: true, status: "pending", paymentIntentId, orderId }, { status: 202 });
      }
    }

    if (!signature || !signature.trim()) {
      if (!shouldAllowUnsignedIntent) {
        return jsonNoStore({ ok: false, error: "Signature required" }, { status: 401 });
      }
      const existing = await getOrderByMerchantId(paymentIntentId);
      if (!existing) {
        await recordOrderStatus({
          merchantOrderId: paymentIntentId,
          orderId,
          eventId: intent.eventId.toString(),
          splitSlug,
          buyerAddress: buyerChecksumForMessage,
          amountTry: intent.amountWei?.toString?.() ?? "0",
          intentAmountWei: intent.amountWei?.toString?.() ?? "0",
          intentDeadline: intent.deadline?.toString?.() ?? "",
          payment_status: "pending",
        });
      }
      if (lockKey) {
        await kv.del(lockKey).catch(() => {});
      }
      return jsonNoStore({ ok: true, status: existing ? "duplicate" : "created", paymentIntentId, orderId });
    }

    const normalizedSig = signature.trim();
    const isHexSig = /^0x[0-9a-fA-F]{130}$/.test(normalizedSig);
    if (!isHexSig) {
      return jsonNoStore({ ok: false, error: "Invalid signature" }, { status: 401 });
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
      return jsonNoStore({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const existing = await getOrderByMerchantId(paymentIntentId);
    if (existing) {
      if (existing.txHash) {
      if (lockKey) {
        await kv.del(lockKey).catch(() => {});
      }
      return jsonNoStore({
        ok: true,
        status: "duplicate",
        txHash: existing.txHash,
        paymentIntentId,
        orderId,
      });
    }
      if (lockKey) {
        await kv.del(lockKey).catch(() => {});
      }
      return jsonNoStore({ ok: true, status: "duplicate", paymentIntentId, orderId });
    }

    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return jsonNoStore({
      ok: true,
      status: "verified",
      paymentIntentId,
      orderId,
    });
  } catch (error) {
    logger.error("intent.error", { error });
    const message = error instanceof Error ? error.message : String(error);
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return jsonNoStore({ ok: false, error: message }, { status: 500 });
  }
}
