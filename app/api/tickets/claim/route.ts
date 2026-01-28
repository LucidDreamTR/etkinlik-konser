import crypto from "crypto";
import { createPublicClient, createWalletClient, getAddress, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { kv } from "@vercel/kv";

import { getOrderByMerchantId, markOrderClaimed } from "@/src/lib/ordersStore";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { createRateLimiter } from "@/src/server/rateLimit";
import { getServerEnv } from "@/src/lib/env";
import { jsonNoStore } from "@/src/lib/http";
import { emitMetric } from "@/src/lib/metrics";
import { getChainConfig } from "@/src/lib/chain";
import { logger } from "@/src/lib/logger";
import { isProdDebugEnabled } from "@/src/lib/debug";
import { hashPaymentPreimage } from "@/src/lib/paymentHash";

const env = getServerEnv();
const chain = getChainConfig();
const RPC_URL = chain.rpcUrl;
const CHAIN_ID = chain.chainId;
const claimLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });
const debugEnabled = isProdDebugEnabled();
const CLAIM_LOCK_TTL_SECONDS = 120;
const hasKv = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

type ClaimPayload = {
  merchantOrderId?: string;
  claimCode?: string;
  walletAddress?: string;
};

function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

function hashClaimCode(claimCode: string): string {
  return crypto.createHash("sha256").update(claimCode).digest("hex");
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

type ClaimErrorReason =
  | "rate_limited"
  | "invalid_json"
  | "missing_merchant_order_id"
  | "missing_claim_code"
  | "invalid_wallet"
  | "order_not_found"
  | "order_not_paid"
  | "already_claimed"
  | "not_owner"
  | "claim_expired"
  | "not_ready"
  | "invalid_code"
  | "server_misconfigured"
  | "claim_failed";

function logClaimFail(
  reason: ClaimErrorReason,
  context: { tokenId: string | null; eventId: string | null; ipHash: string }
) {
  logger.info(`claim.fail.${reason}`, {
    action: "claim",
    reason,
    tokenId: context.tokenId,
    eventId: context.eventId,
    chainId: CHAIN_ID,
    ipHash: context.ipHash,
  });
}

function logClaimSuccess(context: { tokenId: string | null; eventId: string | null; ipHash: string }) {
  logger.info("claim.success", {
    action: "claim",
    reason: "claimed",
    tokenId: context.tokenId,
    eventId: context.eventId,
    chainId: CHAIN_ID,
    ipHash: context.ipHash,
  });
}

export async function POST(request: Request) {
  const route = "/api/tickets/claim";
  const startedAt = Date.now();
  let lockKey: string | null = null;
  const ip = getClientIp(request.headers);
  const ipHash = hashIp(ip);

  if (env.VERCEL_ENV === "production" && !env.FEATURE_TICKETING_ENABLED) {
    return jsonNoStore({ ok: false, error: "Ticketing temporarily disabled" }, { status: 503 });
  }

  const rate = claimLimiter(`${route}:${ip}`);
  if (!rate.ok) {
    const retryAfter = Math.ceil(rate.retryAfterMs / 1000);
    logClaimFail("rate_limited", { tokenId: null, eventId: null, ipHash });
    emitMetric(
      "rate_limit_hit",
      { route, ip, reason: "rate_limit", latencyMs: Date.now() - startedAt }
    );
    return jsonNoStore(
      { ok: false, reason: "rate_limited", error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let payload: ClaimPayload;
  try {
    payload = (await request.json()) as ClaimPayload;
  } catch (error) {
    logClaimFail("invalid_json", { tokenId: null, eventId: null, ipHash });
    return jsonNoStore({ ok: false, reason: "invalid_json", error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof payload?.merchantOrderId !== "string" || !payload.merchantOrderId.trim()) {
    logClaimFail("missing_merchant_order_id", { tokenId: null, eventId: null, ipHash });
    return jsonNoStore(
      { ok: false, reason: "missing_merchant_order_id", error: "Missing merchantOrderId" },
      { status: 400 }
    );
  }
  if (typeof payload?.claimCode !== "string" || !payload.claimCode.trim()) {
    logClaimFail("missing_claim_code", { tokenId: null, eventId: null, ipHash });
    return jsonNoStore({ ok: false, reason: "missing_claim_code", error: "Missing claimCode" }, { status: 400 });
  }
  if (typeof payload?.walletAddress !== "string" || !isAddress(payload.walletAddress)) {
    logClaimFail("invalid_wallet", { tokenId: null, eventId: null, ipHash });
    return jsonNoStore({ ok: false, reason: "invalid_wallet", error: "Invalid walletAddress" }, { status: 400 });
  }

  const walletAddress = getAddress(payload.walletAddress);

  const order = await getOrderByMerchantId(payload.merchantOrderId);
  if (!order) {
    logClaimFail("order_not_found", { tokenId: null, eventId: null, ipHash });
    return jsonNoStore({ ok: false, reason: "order_not_found", error: "Order not found" }, { status: 404 });
  }
  if (order.payment_status !== "paid") {
    logClaimFail("order_not_paid", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "order_not_paid", error: "Order not paid" }, { status: 400 });
  }
  if (order.claimStatus !== "unclaimed") {
    const claimedTo = order.claimedTo ? getAddress(order.claimedTo) : null;
    if (claimedTo && claimedTo !== walletAddress) {
      logClaimFail("not_owner", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
      emitMetric(
        "claim_already",
        {
          route,
          merchantOrderId: order.merchantOrderId,
          ip,
          reason: "not_owner",
          latencyMs: Date.now() - startedAt,
        }
      );
      return jsonNoStore({ ok: false, reason: "not_owner", error: "Not owner" }, { status: 403 });
    }
    logClaimFail("already_claimed", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    emitMetric(
      "claim_already",
      {
        route,
        merchantOrderId: order.merchantOrderId,
        ip,
        reason: "already_claimed",
        latencyMs: Date.now() - startedAt,
      }
    );
    return jsonNoStore({ ok: false, reason: "already_claimed", error: "Already claimed" }, { status: 400 });
  }
  if (!order.custodyAddress || !order.claimCodeHash) {
    return jsonNoStore(
      { ok: true, status: "not_required", message: "Ticket already minted to buyer; no claim needed" },
      { status: 200 }
    );
  }
  if (order.claimExpiresAt) {
    const expiresAt = Date.parse(order.claimExpiresAt);
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
      logClaimFail("claim_expired", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
      return jsonNoStore({ ok: false, reason: "claim_expired", error: "Claim expired" }, { status: 410 });
    }
  }
  if (!order.tokenId || !order.nftAddress) {
    logClaimFail("not_ready", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "not_ready", error: "Order not ready for claim" }, { status: 400 });
  }

  const computed = hashClaimCode(payload.claimCode);
  const computedBuffer = Buffer.from(computed, "utf8");
  const storedBuffer = Buffer.from(order.claimCodeHash, "utf8");
  if (computedBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(computedBuffer, storedBuffer)) {
    logClaimFail("invalid_code", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    emitMetric(
      "claim_already",
      {
        route,
        merchantOrderId: order.merchantOrderId,
        ip,
        reason: "invalid_code",
        latencyMs: Date.now() - startedAt,
      }
    );
    return jsonNoStore({ ok: false, reason: "invalid_code", error: "Invalid claimCode" }, { status: 401 });
  }

  const custodyKeyRaw =
    process.env.CUSTODY_PRIVATE_KEY ?? process.env.BACKEND_WALLET_PRIVATE_KEY ?? process.env.RELAYER_PRIVATE_KEY;
  if (!custodyKeyRaw) {
    logClaimFail("server_misconfigured", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "server_misconfigured", error: "Server misconfigured" }, { status: 500 });
  }
  const custodyKey = (custodyKeyRaw.startsWith("0x") ? custodyKeyRaw : `0x${custodyKeyRaw}`) as `0x${string}`;
  const account = privateKeyToAccount(custodyKey);
  const custodyAddress = getAddress(order.custodyAddress);
  if (account.address !== custodyAddress) {
    logClaimFail("server_misconfigured", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "server_misconfigured", error: "Server misconfigured" }, { status: 500 });
  }

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });

  if (hasKv) {
    lockKey = `claim:lock:${order.tokenId ?? order.merchantOrderId}`;
    const acquired = await kv.set(lockKey, "1", { nx: true, ex: CLAIM_LOCK_TTL_SECONDS });
    if (!acquired) {
      emitMetric(
        "lock_hit",
        {
          route,
          merchantOrderId: order.merchantOrderId,
          ip,
          reason: "lock",
          latencyMs: Date.now() - startedAt,
        }
      );
      return jsonNoStore({ ok: true, status: "pending", message: "Claim already processing" }, { status: 202 });
    }
  }

  const expectedPaymentId =
    order.orderId ?? (order.paymentPreimage ? hashPaymentPreimage(order.paymentPreimage) : null);
  if (expectedPaymentId) {
    try {
      const onchainPaymentId = (await publicClient.readContract({
        address: getAddress(order.nftAddress),
        abi: eventTicketAbi,
        functionName: "paymentIdOf",
        args: [BigInt(order.tokenId)],
      })) as `0x${string}`;
      if (onchainPaymentId.toLowerCase() !== expectedPaymentId.toLowerCase()) {
        logClaimFail("invalid_code", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
        if (lockKey) {
          await kv.del(lockKey).catch(() => {});
        }
        return jsonNoStore(
          { ok: false, reason: "invalid_code", error: "Claim does not match payment mapping" },
          { status: 401 }
        );
      }
    } catch {
      if (lockKey) {
        await kv.del(lockKey).catch(() => {});
      }
      return jsonNoStore({ ok: false, reason: "not_ready", error: "Unable to verify payment mapping" }, { status: 500 });
    }
  }

  try {
    const { request: transferRequest } = await publicClient.simulateContract({
      account,
      address: getAddress(order.nftAddress),
      abi: eventTicketAbi,
      functionName: "safeTransferFrom",
      args: [custodyAddress, walletAddress, BigInt(order.tokenId)],
    });

    let chainClaimed = false;
    let chainClaimTxHash: `0x${string}` | null = null;
    let chainClaimError: string | null = null;

    // Contract claim() requires current owner; custody owns the token before transfer.
    try {
      const { request: claimRequest } = await publicClient.simulateContract({
        account,
        address: getAddress(order.nftAddress),
        abi: eventTicketAbi,
        functionName: "claim",
        args: [BigInt(order.tokenId)],
      });

      chainClaimTxHash = await walletClient.writeContract(claimRequest);
      await publicClient.waitForTransactionReceipt({ hash: chainClaimTxHash });
      chainClaimed = true;
    } catch (error) {
      chainClaimError = error instanceof Error ? error.message : "Unknown error";
      chainClaimed = false;
    }

    const transferTxHash = await walletClient.writeContract(transferRequest);
    await publicClient.waitForTransactionReceipt({ hash: transferTxHash });

    await markOrderClaimed({
      merchantOrderId: order.merchantOrderId,
      claimedTo: walletAddress,
      claimedAt: new Date().toISOString(),
      txHash: transferTxHash,
      chainClaimed,
      chainClaimTxHash,
      chainClaimError,
    });

    logClaimSuccess({ tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    emitMetric(
      "claim_ok",
      { route, merchantOrderId: order.merchantOrderId, ip, latencyMs: Date.now() - startedAt }
    );
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return jsonNoStore({
      ok: true,
      status: "claimed",
      transferTxHash,
      chainClaimed,
      ...(debugEnabled && chainClaimTxHash ? { chainClaimTxHash } : {}),
      ...(debugEnabled && chainClaimError ? { chainClaimError } : {}),
    });
  } catch (error) {
    logClaimFail("claim_failed", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return jsonNoStore({ ok: false, reason: "claim_failed", error: "Claim failed" }, { status: 500 });
  }
}
