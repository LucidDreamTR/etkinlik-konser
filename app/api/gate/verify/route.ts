import crypto from "crypto";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { kv } from "@vercel/kv";

import { getTicketContractAddress } from "@/lib/site";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { getOrderByMerchantId, getOrderByTokenId, markOrderClaimed, markTokenUsedOnce, persistOrder } from "@/src/lib/ordersStore";
import { hashClaimCode, isFormattedClaimCode, normalizeFormattedClaimCode } from "@/src/lib/claimCode";
import { hashPaymentPreimage } from "@/src/lib/paymentHash";
import { shouldIncludeGateDebug } from "@/src/server/debugFlags";
import { createRateLimiter } from "@/src/server/rateLimit";
import { getServerEnv } from "@/src/lib/env";
import { jsonNoStore } from "@/src/lib/http";
import { emitMetric } from "@/src/lib/metrics";
import { getChainConfig } from "@/src/lib/chain";
import { logger } from "@/src/lib/logger";
import { applyAtLeastTransition, applyTransition, ensureTicketState } from "@/src/lib/ticketLifecycle";
import { verifyOperatorKey } from "@/src/lib/operatorKeys";
import { deriveOperatorKeyId, logAudit } from "@/src/lib/auditLog";

const verifyLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });
const verifyTokenLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });
const env = getServerEnv();
const chain = getChainConfig();
const RPC_URL = chain.rpcUrl;
const CHAIN_ID = chain.chainId;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const debugEnabled = shouldIncludeGateDebug();
const INVALID_CODE_LIMIT = 5;
const INVALID_CODE_LOCK_MINUTES = 10;
const INVALID_CODE_WINDOW_SECONDS = 15 * 60;
const GATE_LOCK_TTL_SECONDS = 10;
const hasKv = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
const gateVerifyRateState = new Map<string, { count: number; resetAt: number }>();

function getGateVerifyRateConfig() {
  const windowSecRaw = process.env.GATE_VERIFY_RL_WINDOW_SEC;
  const maxRaw = process.env.GATE_VERIFY_RL_MAX;
  const windowSec = Math.max(1, Number(windowSecRaw ?? 60));
  const max = Math.max(1, Number(maxRaw ?? 60));
  return {
    windowMs: windowSec * 1000,
    max,
  };
}

function checkGateVerifyRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const { windowMs, max } = getGateVerifyRateConfig();
  const now = Date.now();
  const entry = gateVerifyRateState.get(ip);
  if (!entry || now >= entry.resetAt) {
    gateVerifyRateState.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  entry.count += 1;
  return { ok: true };
}

type VerifyPayload = {
  operatorKey?: string;
  eventId?: string | number;
  tokenId?: string | number;
  code?: string;
  merchantOrderId?: string;
};

type VerifyErrorReason =
  | "rate_limited"
  | "invalid_json"
  | "missing_operator_key"
  | "invalid_token"
  | "event_mismatch"
  | "missing_code"
  | "order_not_found"
  | "temporarily_locked"
  | "onchain_error"
  | "not_claimed"
  | "payment_missing"
  | "invalid_code"
  | "payment_mismatch"
  | "not_owner"
  | "already_used"
  | "invalid_operator_key";

function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

function hashUa(ua: string | null): string | null {
  if (!ua) return null;
  const trimmed = ua.trim();
  if (!trimmed) return null;
  return crypto.createHash("sha256").update(trimmed).digest("hex");
}

function createRequestId(): string {
  return crypto.randomBytes(6).toString("hex");
}

function logGateFailure(reason: VerifyErrorReason, tokenId: string, eventId: string | null, ipHash: string) {
  logger.info(`gate.verify.fail.${reason}`, {
    action: "gate.verify",
    reason,
    tokenId,
    eventId,
    chainId: CHAIN_ID,
    ipHash,
  });
}

function logGateSuccess(tokenId: string, eventId: string | null, ipHash: string) {
  logger.info("gate.verify.success", {
    action: "gate.verify",
    reason: "valid",
    tokenId,
    eventId,
    chainId: CHAIN_ID,
    ipHash,
  });
}

function respondFailure({
  ok,
  reason,
  status,
  tokenId,
  eventId,
  owner,
  claimed,
  details,
  debugExtras,
}: {
  ok: boolean;
  reason: VerifyErrorReason;
  status: number;
  tokenId: string;
  eventId: string | null;
  owner?: string | null;
  claimed?: boolean;
  details?: string;
  debugExtras?: Record<string, unknown>;
}) {
  const allowDetails = !(env.MAINNET_ENABLED || CHAIN_ID === 1);
  return jsonNoStore(
    {
      ok,
      valid: false,
      reason,
      chainId: CHAIN_ID,
      tokenId,
      ...(debugEnabled ? { eventId } : {}),
      ...(typeof owner === "string" ? { owner } : {}),
      ...(typeof claimed === "boolean" ? { claimed } : {}),
      ...(details && allowDetails ? { details } : {}),
      ...(debugEnabled && debugExtras ? debugExtras : {}),
    },
    { status }
  );
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

function parseEventId(value: unknown): bigint | null {
  return parseTokenId(value);
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeMerchantOrderId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isBytes32Hex(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

export async function POST(request: Request) {
  const route = "/api/gate/verify";
  const startedAt = Date.now();
  let gateLockKey: string | null = null;
  const requestId = createRequestId();
  const ip = getClientIp(request.headers);
  const ipHash = hashIp(ip);
  const uaHash = hashUa(request.headers.get("user-agent"));
  const rateCheck = checkGateVerifyRateLimit(ip);
  if (!rateCheck.ok) {
    logAudit({
      route: "gate_verify",
      reason: "rate_limited",
      operatorKeyId: "unknown",
      eventId: null,
      tokenId: "unknown",
      ipHash,
      uaHash,
      requestId,
    });
    return jsonNoStore(
      { ok: false, reason: "rate_limited", retryAfterSec: rateCheck.retryAfterSec },
      { status: 429 }
    );
  }

  try {
    if (env.VERCEL_ENV === "production" && !env.FEATURE_TICKETING_ENABLED) {
      return jsonNoStore({ ok: false, valid: false, reason: "disabled", chainId: CHAIN_ID }, { status: 503 });
    }

    const rate = verifyLimiter(`${route}:${ip}`);
    if (!rate.ok) {
      const retryAfter = Math.ceil(rate.retryAfterMs / 1000);
      logAudit({
        route: "gate_verify",
        reason: "rate_limited",
        operatorKeyId: "unknown",
        eventId: null,
        tokenId: "unknown",
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("rate_limited", "unknown", null, ipHash);
      emitMetric(
        "rate_limit_hit",
        { route, ip, reason: "rate_limit", latencyMs: Date.now() - startedAt }
      );
      return jsonNoStore(
        {
          ok: false,
          valid: false,
          reason: "rate_limited",
          chainId: CHAIN_ID,
          tokenId: "unknown",
          ...(debugEnabled ? { eventId: null } : {}),
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let payload: VerifyPayload;
    // QR code content === payment preimage; expectedHash = keccak256(preimage).
    try {
      payload = (await request.json()) as VerifyPayload;
    } catch {
      logGateFailure("invalid_json", "unknown", null, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: "unknown",
        ip,
        reason: "invalid_json",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: false,
        reason: "invalid_json",
        status: 400,
        tokenId: "unknown",
        eventId: null,
        details: "Invalid JSON",
      });
    }

    const operatorKey = typeof payload?.operatorKey === "string" ? payload.operatorKey : null;
    if (!operatorKey || !operatorKey.trim()) {
      verifyOperatorKey(operatorKey, { ipHash });
      logAudit({
        route: "gate_verify",
        reason: "missing_operator_key",
        operatorKeyId: "unknown",
        eventId: null,
        tokenId: "unknown",
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("missing_operator_key", "unknown", null, ipHash);
      emitMetric(
        "gate_invalid",
        { route, ip, reason: "missing_operator_key", latencyMs: Date.now() - startedAt }
      );
      return jsonNoStore(
        { ok: false, valid: false, reason: "missing_operator_key", chainId: CHAIN_ID },
        { status: 401 }
      );
    }

    const keyCheck = verifyOperatorKey(operatorKey, { ipHash });
    if (!keyCheck.ok) {
      logAudit({
        route: "gate_verify",
        reason: "invalid_operator_key",
        operatorKeyId: deriveOperatorKeyId(operatorKey),
        eventId: null,
        tokenId: "unknown",
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("invalid_operator_key", "unknown", null, ipHash);
      emitMetric(
        "gate_invalid",
        { route, ip, reason: "invalid_operator_key", latencyMs: Date.now() - startedAt }
      );
      return jsonNoStore(
        { ok: false, valid: false, reason: "invalid_operator_key", chainId: CHAIN_ID },
        { status: 401 }
      );
    }

    const tokenId = parseTokenId(payload?.tokenId);
    if (tokenId === null) {
      logGateFailure("invalid_token", "unknown", null, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: "unknown",
        ip,
        reason: "invalid_token",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: false,
        reason: "invalid_token",
        status: 400,
        tokenId: "unknown",
        eventId: null,
        details: "Invalid tokenId",
      });
    }

    const tokenIdString = tokenId.toString();
    const operatorKeyId = deriveOperatorKeyId(operatorKey);
    const inputEventId = parseEventId(payload?.eventId);
    if (inputEventId === null) {
      logAudit({
        route: "gate_verify",
        reason: "invalid_token",
        operatorKeyId,
        eventId: null,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("invalid_token", tokenIdString, null, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: tokenIdString,
        ip,
        reason: "invalid_event",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: false,
        reason: "invalid_token",
        status: 400,
        tokenId: tokenIdString,
        eventId: null,
        details: "Invalid eventId",
      });
    }

    const inputEventIdString = inputEventId.toString();
    const tokenRate = verifyTokenLimiter(`${route}:${ip}:${tokenIdString}`);
    if (!tokenRate.ok) {
      const retryAfter = Math.ceil(tokenRate.retryAfterMs / 1000);
      logAudit({
        route: "gate_verify",
        reason: "rate_limited",
        operatorKeyId,
        eventId: inputEventIdString,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("rate_limited", tokenIdString, null, ipHash);
      emitMetric(
        "rate_limit_hit",
        { route, ip, reason: "rate_limit", latencyMs: Date.now() - startedAt }
      );
      return jsonNoStore(
        {
          ok: false,
          valid: false,
          reason: "rate_limited",
          chainId: CHAIN_ID,
          tokenId: tokenIdString,
          ...(debugEnabled ? { eventId: null } : {}),
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    const code = normalizeCode(payload?.code);
    if (!code) {
      logAudit({
        route: "gate_verify",
        reason: "missing_code",
        operatorKeyId,
        eventId: inputEventIdString,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("missing_code", tokenIdString, null, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: tokenIdString,
        ip,
        reason: "missing_code",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: false,
        reason: "missing_code",
        status: 400,
        tokenId: tokenIdString,
        eventId: null,
        details: "Missing code",
      });
    }

    if (hasKv) {
      const lockKey = `gate:verify:lock:${tokenIdString}`;
      const locked = await kv.get<string>(lockKey);
      if (locked) {
        logAudit({
          route: "gate_verify",
          reason: "temporarily_locked",
          operatorKeyId,
          eventId: inputEventIdString,
          tokenId: tokenIdString,
          ipHash,
          uaHash,
          requestId,
        });
        logGateFailure("temporarily_locked", tokenIdString, null, ipHash);
        emitMetric(
          "lock_hit",
          { route, tokenId: tokenIdString, ip, reason: "lock", latencyMs: Date.now() - startedAt }
        );
        return respondFailure({
          ok: true,
          reason: "temporarily_locked",
          status: 429,
          tokenId: tokenIdString,
          eventId: null,
          details: "Too many invalid attempts",
        });
      }

      gateLockKey = `gate:lock:${tokenIdString}`;
      const gateLocked = await kv.set(gateLockKey, "1", { nx: true, ex: GATE_LOCK_TTL_SECONDS });
      if (!gateLocked) {
        logAudit({
          route: "gate_verify",
          reason: "temporarily_locked",
          operatorKeyId,
          eventId: inputEventIdString,
          tokenId: tokenIdString,
          ipHash,
          uaHash,
          requestId,
        });
        logGateFailure("temporarily_locked", tokenIdString, null, ipHash);
        emitMetric(
          "lock_hit",
          { route, tokenId: tokenIdString, ip, reason: "lock", latencyMs: Date.now() - startedAt }
        );
        return respondFailure({
          ok: true,
          reason: "temporarily_locked",
          status: 429,
          tokenId: tokenIdString,
          eventId: null,
          details: "Verification already in progress",
        });
      }
    }

    const contractAddressRaw = getTicketContractAddress({ server: true });
    const contractAddress = isAddress(contractAddressRaw) ? (getAddress(contractAddressRaw) as `0x${string}`) : null;
    if (!contractAddress) {
      logGateFailure("onchain_error", tokenIdString, null, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: tokenIdString,
        ip,
        reason: "onchain_error",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: true,
        reason: "onchain_error",
        status: 200,
        tokenId: tokenIdString,
        eventId: null,
        details: "Invalid contract address",
      });
    }

    const client = createPublicClient({ transport: http(RPC_URL) });

    let owner: string | null = null;
    let onchainClaimed = false;
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
        }) as Promise<readonly [bigint, boolean, `0x${string}`, `0x${string}`, number, number]>,
        client.readContract({
          address: contractAddress,
          abi: eventTicketAbi,
          functionName: "paymentIdOf",
          args: [tokenId],
        }) as Promise<`0x${string}`>,
      ]);

      owner = getAddress(ownerRaw);
      eventId = ticketMeta[0].toString();
      onchainClaimed = Boolean(ticketMeta[1]);
      paymentIdOnchain = paymentId.toLowerCase();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logGateFailure("onchain_error", tokenIdString, null, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: tokenIdString,
        ip,
        reason: "onchain_error",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: true,
        reason: "onchain_error",
        status: 200,
        tokenId: tokenIdString,
        eventId: null,
        details: message,
      });
    }

    if (eventId !== inputEventIdString) {
      logAudit({
        route: "gate_verify",
        reason: "event_mismatch",
        operatorKeyId,
        eventId,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("event_mismatch", tokenIdString, eventId, ipHash);
      emitMetric(
        "gate_invalid",
        { route, tokenId: tokenIdString, ip, reason: "event_mismatch", latencyMs: Date.now() - startedAt }
      );
      return respondFailure({
        ok: false,
        reason: "event_mismatch",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: onchainClaimed,
        details: "EventId does not match token",
      });
    }

    if (!paymentIdOnchain || paymentIdOnchain === ZERO_BYTES32) {
      logGateFailure("payment_missing", tokenIdString, eventId, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: tokenIdString,
        ip,
        reason: "payment_missing",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: true,
        reason: "payment_missing",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: onchainClaimed,
        details: "Missing paymentId onchain",
        debugExtras: debugEnabled ? { paymentIdOnchain } : undefined,
      });
    }
    const merchantOrderId = normalizeMerchantOrderId(payload?.merchantOrderId);
    const orderByToken = await getOrderByTokenId(tokenIdString);
    const orderByMerchant = !orderByToken && merchantOrderId ? await getOrderByMerchantId(merchantOrderId) : undefined;
    let order = orderByToken ?? orderByMerchant;
    if (!order) {
      logGateFailure("order_not_found", tokenIdString, eventId, ipHash);
      emitMetric(
        "gate_invalid",
        { route, tokenId: tokenIdString, ip, reason: "order_not_found", latencyMs: Date.now() - startedAt }
      );
      return respondFailure({
        ok: true,
        reason: "order_not_found",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: onchainClaimed,
        details: "Order not found for token",
        debugExtras: debugEnabled ? { paymentIdOnchain } : undefined,
      });
    }

    order = ensureTicketState(order);
    const trimmedCode = code.trim();
    let codeMatches = false;
    if (order.claimCode) {
      const requestUpper = trimmedCode.toUpperCase();
      const storedUpper = order.claimCode.toUpperCase();
      if (isFormattedClaimCode(requestUpper) && isFormattedClaimCode(storedUpper)) {
        const normalizedRequest = normalizeFormattedClaimCode(requestUpper);
        const normalizedStored = normalizeFormattedClaimCode(storedUpper);
        const computedBuffer = Buffer.from(normalizedRequest, "utf8");
        const storedBuffer = Buffer.from(normalizedStored, "utf8");
        codeMatches =
          computedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(computedBuffer, storedBuffer);
      } else {
        const computedBuffer = Buffer.from(trimmedCode, "utf8");
        const storedBuffer = Buffer.from(order.claimCode, "utf8");
        codeMatches =
          computedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(computedBuffer, storedBuffer);
      }
    } else if (order.claimCodeHash) {
      const computed = hashClaimCode(trimmedCode);
      const computedBuffer = Buffer.from(computed, "utf8");
      const storedBuffer = Buffer.from(order.claimCodeHash, "utf8");
      codeMatches =
        computedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(computedBuffer, storedBuffer);
    }

    const expectedHash = isBytes32Hex(trimmedCode)
      ? trimmedCode.toLowerCase()
      : hashPaymentPreimage(trimmedCode).toLowerCase();
    const normalizedOnchain = paymentIdOnchain.toLowerCase();
    const paymentMatches = expectedHash === normalizedOnchain;

    if ((order.claimCode || order.claimCodeHash) && !codeMatches) {
      logAudit({
        route: "gate_verify",
        reason: "invalid_code",
        operatorKeyId,
        eventId,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("invalid_code", tokenIdString, eventId, ipHash);
      emitMetric(
        "gate_invalid",
        { route, tokenId: tokenIdString, ip, reason: "invalid_code", latencyMs: Date.now() - startedAt }
      );
      return respondFailure({
        ok: true,
        reason: "invalid_code",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: onchainClaimed,
        details: "Invalid claim code",
        debugExtras: debugEnabled ? { paymentIdOnchain } : undefined,
      });
    }

    if (!order.claimCode && !order.claimCodeHash && !paymentMatches) {
      logAudit({
        route: "gate_verify",
        reason: "payment_mismatch",
        operatorKeyId,
        eventId,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("payment_mismatch", tokenIdString, eventId, ipHash);
      if (hasKv) {
        const invalidKey = `gate:verify:invalid:${tokenIdString}`;
        const count = await kv.incr(invalidKey);
        if (count === 1) {
          await kv.expire(invalidKey, INVALID_CODE_WINDOW_SECONDS);
        }
        if (count >= INVALID_CODE_LIMIT) {
          const lockKey = `gate:verify:lock:${tokenIdString}`;
          await kv.set(lockKey, "1", { ex: INVALID_CODE_LOCK_MINUTES * 60 });
          await kv.del(invalidKey).catch(() => {});
        }
      }
      emitMetric(
        "gate_invalid",
        { route, tokenId: tokenIdString, ip, reason: "payment_mismatch", latencyMs: Date.now() - startedAt }
      );
      return respondFailure({
        ok: true,
        reason: "payment_mismatch",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: onchainClaimed,
        details: "Payment hash does not match",
        debugExtras: debugEnabled ? { paymentIdOnchain, expectedHash } : undefined,
      });
    }

    const responseClaimed =
      onchainClaimed === true ||
      order.claimStatus === "claimed" ||
      order.ticketState === "claimed" ||
      order.ticketState === "gate_validated";
    if (!responseClaimed) {
      logAudit({
        route: "gate_verify",
        reason: "not_claimed",
        operatorKeyId,
        eventId,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("not_claimed", tokenIdString, eventId, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: tokenIdString,
        ip,
        reason: "not_claimed",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: true,
        reason: "not_claimed",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: false,
        details: "Ticket not claimed",
        debugExtras: debugEnabled ? { paymentIdOnchain } : undefined,
      });
    }

    if (!onchainClaimed) {
      let buyerAddress: string | null = null;
      if (order.buyerAddress) {
        try {
          buyerAddress = getAddress(order.buyerAddress);
        } catch {
          buyerAddress = null;
        }
      }
      if (buyerAddress && owner && buyerAddress === owner) {
        const now = new Date().toISOString();
        const updated = applyAtLeastTransition(order, "claimed", {
          claimStatus: "claimed",
          claimedTo: order.claimedTo ?? owner,
          claimedAt: order.claimedAt ?? now,
          claimCode: order.claimCode ?? (order.claimCodeHash ? null : trimmedCode),
          claimCodeHash: order.claimCodeHash ?? hashClaimCode(trimmedCode),
          claimCodeCreatedAt: order.claimCodeCreatedAt ?? now,
        });
        await persistOrder(updated);
        order = updated;
      } else {
        logAudit({
          route: "gate_verify",
          reason: "not_claimed",
          operatorKeyId,
          eventId,
          tokenId: tokenIdString,
          ipHash,
          uaHash,
          requestId,
        });
        logGateFailure("not_claimed", tokenIdString, eventId, ipHash);
        emitMetric("gate_invalid", {
          route,
          tokenId: tokenIdString,
          ip,
          reason: "not_claimed",
          latencyMs: Date.now() - startedAt,
        });
        return respondFailure({
          ok: true,
          reason: "not_claimed",
          status: 200,
          tokenId: tokenIdString,
          eventId,
          owner,
          claimed: false,
          details: "Ticket not claimed",
          debugExtras: debugEnabled ? { paymentIdOnchain } : undefined,
        });
      }
    }

    if (order.ticketState === "claimed" && order.claimStatus !== "claimed") {
      let buyerAddress: string | null = null;
      if (order.buyerAddress) {
        try {
          buyerAddress = getAddress(order.buyerAddress);
        } catch {
          buyerAddress = null;
        }
      }
      if (buyerAddress && owner && buyerAddress === owner) {
        const now = new Date().toISOString();
        const updated = applyAtLeastTransition(order, "claimed", {
          claimStatus: "claimed",
          claimedTo: order.claimedTo ?? owner,
          claimedAt: order.claimedAt ?? now,
        });
        await persistOrder(updated);
        order = updated;
      }
    }

    const claimedToStored: string | null = order.claimedTo ?? null;
    const claimedToOnchain: string | null = owner ?? null;
    let claimedToMismatchHealed = false;

    if (order.ticketState === "gate_validated") {
      logAudit({
        route: "gate_verify",
        reason: "already_used",
        operatorKeyId,
        eventId,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("already_used", tokenIdString, eventId, ipHash);
      emitMetric(
        "gate_invalid",
        { route, tokenId: tokenIdString, ip, reason: "already_used", latencyMs: Date.now() - startedAt }
      );
      return respondFailure({
        ok: true,
        reason: "already_used",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: responseClaimed,
        details: "Ticket already used",
        debugExtras: debugEnabled ? { claimedToStored, claimedToOnchain, claimedToMismatchHealed } : undefined,
      });
    }

    if (order.ticketState !== "claimed") {
      logAudit({
        route: "gate_verify",
        reason: "not_claimed",
        operatorKeyId,
        eventId,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("not_claimed", tokenIdString, eventId, ipHash);
      emitMetric("gate_invalid", {
        route,
        tokenId: tokenIdString,
        ip,
        reason: "not_claimed",
        latencyMs: Date.now() - startedAt,
      });
      return respondFailure({
        ok: true,
        reason: "not_claimed",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: responseClaimed,
        details: "Ticket not in claimed state",
        debugExtras: debugEnabled ? { claimedToStored, claimedToOnchain, claimedToMismatchHealed } : undefined,
      });
    }

    if (order.claimedTo && owner) {
      try {
        const claimedTo = getAddress(order.claimedTo);
        if (claimedTo !== owner) {
          if (onchainClaimed === true && order.merchantOrderId && order.txHash) {
            try {
              await markOrderClaimed({
                merchantOrderId: order.merchantOrderId,
                claimedTo: owner,
                claimedAt: new Date().toISOString(),
                txHash: order.txHash,
                chainClaimed: order.chainClaimed ?? null,
                chainClaimTxHash: order.chainClaimTxHash ?? null,
                chainClaimError: order.chainClaimError ?? null,
              });
              claimedToMismatchHealed = true;
            } catch {
              // best-effort sync only
            }
          } else {
            logAudit({
              route: "gate_verify",
              reason: "not_owner",
              operatorKeyId,
              eventId,
              tokenId: tokenIdString,
              ipHash,
              uaHash,
              requestId,
            });
            logGateFailure("not_owner", tokenIdString, eventId, ipHash);
            emitMetric("gate_invalid", {
              route,
              tokenId: tokenIdString,
              ip,
              reason: "not_owner",
              latencyMs: Date.now() - startedAt,
            });
            return respondFailure({
              ok: true,
              reason: "not_owner",
              status: 200,
              tokenId: tokenIdString,
              eventId,
              owner,
              claimed: responseClaimed,
              details: "Owner does not match claimed address",
              debugExtras: debugEnabled
                ? { claimedToStored: order.claimedTo, claimedToOnchain: owner, claimedToMismatchHealed: false }
                : undefined,
            });
          }
        }
      } catch {
        // If stored claimedTo is invalid, skip owner check to avoid false negatives.
      }
    }

    const useResult = await markTokenUsedOnce({
      tokenId: tokenIdString,
      owner,
      eventId,
    });
    if (useResult.alreadyUsed) {
      const updated = applyAtLeastTransition(order, "gate_validated", {
        usedAt: useResult.usedAt,
        gateValidatedAt: useResult.usedAt,
        claimStatus: order.claimStatus ?? "claimed",
        claimedTo: order.claimedTo ?? owner ?? null,
        claimedAt: order.claimedAt ?? useResult.usedAt,
      });
      await persistOrder(updated);
      logAudit({
        route: "gate_verify",
        reason: "already_used",
        operatorKeyId,
        eventId,
        tokenId: tokenIdString,
        ipHash,
        uaHash,
        requestId,
      });
      logGateFailure("already_used", tokenIdString, eventId, ipHash);
      emitMetric(
        "gate_invalid",
        { route, tokenId: tokenIdString, ip, reason: "already_used", latencyMs: Date.now() - startedAt }
      );
      return respondFailure({
        ok: true,
        reason: "already_used",
        status: 200,
        tokenId: tokenIdString,
        eventId,
        owner,
        claimed: true,
        details: "Ticket already used",
        debugExtras: debugEnabled
          ? { claimedToStored, claimedToOnchain, claimedToMismatchHealed }
          : undefined,
      });
    }

    const updatedOrder = applyTransition(order, "gate_validated", {
      usedAt: useResult.usedAt,
      gateValidatedAt: useResult.usedAt,
      eventId: order.eventId || eventId,
      claimStatus: order.claimStatus ?? "claimed",
      claimedTo: order.claimedTo ?? owner ?? null,
      claimedAt: order.claimedAt ?? useResult.usedAt,
    });
    await persistOrder(updatedOrder);

    logAudit({
      route: "gate_verify",
      reason: "valid",
      operatorKeyId,
      eventId,
      tokenId: tokenIdString,
      ipHash,
      uaHash,
      requestId,
    });
    logGateSuccess(tokenIdString, eventId, ipHash);

    emitMetric(
      "gate_valid",
      { route, tokenId: tokenIdString, ip, latencyMs: Date.now() - startedAt }
    );
    return jsonNoStore({
      ok: true,
      valid: true,
      reason: "valid",
      chainId: CHAIN_ID,
      tokenId: tokenIdString,
      owner,
      ...(debugEnabled ? { eventId } : {}),
      claimed: true,
      ...(debugEnabled
        ? { paymentIdOnchain, expectedHash, claimedToStored, claimedToOnchain, claimedToMismatchHealed }
        : {}),
    });
  } finally {
    if (gateLockKey && hasKv) {
      await kv.del(gateLockKey).catch(() => {});
    }
  }
}
