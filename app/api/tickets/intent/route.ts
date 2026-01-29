import crypto from "node:crypto";
import { getAddress } from "viem";
import { kv } from "@vercel/kv";

import { EVENTS } from "@/data/events";
import { getOrderByMerchantId, persistOrder, recordOrderStatus } from "@/src/lib/ordersStore";
import { applyAtLeastTransition } from "@/src/lib/ticketLifecycle";
import { computeOrderId } from "@/src/server/orderId";
import { createRateLimiter } from "@/src/server/rateLimit";
import { getTicketContractAddress } from "@/lib/site";
import { getServerEnv } from "@/src/lib/env";
import { jsonNoStore } from "@/src/lib/http";
import { toJsonSafe } from "@/src/lib/json";
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

function errorResponse(reason: string, error: string, status: number, extra?: Record<string, unknown>) {
  return jsonNoStore({ ok: false, reason, error, ...(extra ?? {}) }, { status });
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
        { ok: false, reason: "rate_limited", error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const raw = await request.text();
    if (!raw) {
      return errorResponse("empty_body", "Empty body", 400);
    }

    let payload: IntentPayload;
    try {
      payload = JSON.parse(raw) as IntentPayload;
    } catch {
      return errorResponse("invalid_json", "Invalid JSON", 400);
    }

    const intent = payload.intent;
    if (!intent) {
      return errorResponse("missing_intent", "Missing intent", 400);
    }

    const buyerRaw = (intent as { buyer?: unknown } | undefined)?.buyer;
    const buyer = typeof buyerRaw === "string" ? buyerRaw : "";

    let buyerChecksum: `0x${string}`;
    try {
      buyerChecksum = getAddress(buyer);
    } catch {
      return errorResponse(
        "invalid_buyer",
        "Invalid intent.buyer",
        400,
        { buyer: buyerRaw ?? null }
      );
    }
    const defaultEvent = EVENTS[0];
    const splitSlug = intent.splitSlug ?? defaultEvent?.splitId ?? defaultEvent?.planId ?? defaultEvent?.slug ?? "";
    const paymentIntentId = intent.merchantOrderId?.trim() || crypto.randomUUID();

    let verifyingContract: `0x${string}`;
    try {
      verifyingContract = getTicketContractAddress({ server: true });
    } catch {
      return errorResponse("invalid_contract", "Invalid verifyingContract", 400);
    }

    const deadline = normalizeBigInt(intent.deadline);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (deadline < now) {
      return errorResponse("intent_expired", "Intent expired", 400);
    }

    const domain = {
      name: "EtkinlikKonser",
      version: "1",
      chainId: chain.chainId,
      verifyingContract,
    } as const;

    const message = {
      buyer: buyerChecksum,
      splitSlug,
      merchantOrderId: paymentIntentId,
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
      return errorResponse(
        "invalid_contract",
        "domain.verifyingContract is undefined",
        400,
        debugEnabled ? { debug } : undefined
      );
    }

    if (!debug.messageBuyer || String(debug.messageBuyer) === "undefined") {
      return errorResponse(
        "invalid_buyer",
        "message.buyer is undefined",
        400,
        debugEnabled ? { debug } : undefined
      );
    }

    try {
      getAddress(String(debug.domainVerifyingContract));
    } catch {
      return errorResponse(
        "invalid_contract",
        "domain.verifyingContract invalid",
        400,
        debugEnabled ? { debug } : undefined
      );
    }
    try {
      getAddress(String(debug.messageBuyer));
    } catch {
      return errorResponse(
        "invalid_buyer",
        "message.buyer invalid",
        400,
        debugEnabled ? { debug } : undefined
      );
    }

    const orderId = computeOrderId({
      paymentIntentId,
      buyer: buyerChecksum,
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
      } else {
        const updated = applyAtLeastTransition(existing, "intent_created", {
          orderId: existing.orderId ?? orderId,
          eventId: existing.eventId ?? intent.eventId.toString(),
          splitSlug: existing.splitSlug ?? splitSlug,
          buyerAddress: existing.buyerAddress ?? buyerChecksum,
          amountTry: existing.amountTry ?? (intent.amountWei?.toString?.() ?? "0"),
          intentAmountWei: existing.intentAmountWei ?? (intent.amountWei?.toString?.() ?? "0"),
          intentDeadline: existing.intentDeadline ?? (intent.deadline?.toString?.() ?? ""),
        });
      await persistOrder(updated);
    }

    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return jsonNoStore(
      toJsonSafe({
        ok: true,
        status: existing ? "duplicate" : "created",
        paymentIntentId,
        merchantOrderId: paymentIntentId,
        orderId,
        domain,
        types: INTENT_TYPES,
        message,
        intentToSign: { domain, types: INTENT_TYPES, primaryType: "TicketIntent", message },
      })
    );
  } catch (error) {
    logger.error("intent.error", { error });
    const message = error instanceof Error ? error.message : String(error);
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return errorResponse("server_error", message, 500);
  }
}
