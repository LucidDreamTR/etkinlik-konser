import crypto from "crypto";
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { getAddress, isAddress } from "viem";
import { kv } from "@vercel/kv";

import { hashClaimCode, isFormattedClaimCode, normalizeFormattedClaimCode } from "@/src/lib/claimCode";
import { getOrderByMerchantId, markOrderClaimed, persistOrder } from "@/src/lib/ordersStore";
import { applyAtLeastTransition, ensureTicketState } from "@/src/lib/ticketLifecycle";
import { createRateLimiter } from "@/src/server/rateLimit";
import { getServerEnv } from "@/src/lib/env";
import { jsonNoStore } from "@/src/lib/http";
import { emitMetric } from "@/src/lib/metrics";
import { getChainConfig } from "@/src/lib/chain";
import { logger } from "@/src/lib/logger";
import { isProdDebugEnabled } from "@/src/lib/debug";
import { hashPaymentPreimage } from "@/src/lib/paymentHash";
import { resolveMintModeFromOrder } from "@/src/lib/mintMode";
import { checkRelayerGasBalance } from "@/src/lib/gasCheck";

const env = getServerEnv();
const chain = getChainConfig();
const RPC_URL = chain.rpcUrl;
const CHAIN_ID = chain.chainId;
const claimLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });
const claimTokenLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });
const debugEnabled = isProdDebugEnabled();
const CLAIM_LOCK_TTL_SECONDS = 120;
const hasKv = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

type ClaimPayload = {
  tokenId?: string;
  merchantOrderId?: string;
  claimCode?: string;
  walletAddress?: string;
};

function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
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
  context: { tokenId: string | null; eventId: string | null; ipHash: string },
  extra?: Record<string, unknown>
) {
  logger.info(`claim.fail.${reason}`, {
    action: "claim",
    reason,
    tokenId: context.tokenId,
    eventId: context.eventId,
    chainId: CHAIN_ID,
    ipHash: context.ipHash,
    ...extra,
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

const eventTicketClaimAbi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function safeTransferFrom(address from,address to,uint256 tokenId)",
  "function transferFrom(address from,address to,uint256 tokenId)",
  "function paymentIdOf(uint256 tokenId) view returns (bytes32)",
  "function claim(uint256 tokenId)",
];

async function getOnchainOwner(
  order: { tokenId?: string | null; nftAddress?: string | null },
  provider: JsonRpcProvider
) {
  if (!order.tokenId || !order.nftAddress) return null;
  const contract = new Contract(getAddress(order.nftAddress), eventTicketClaimAbi, provider);
  const ownerRaw = (await contract.ownerOf(BigInt(order.tokenId))) as string;
  return getAddress(ownerRaw);
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
  } catch {
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
  const orderRaw = await getOrderByMerchantId(payload.merchantOrderId);
  const order = orderRaw ? ensureTicketState(orderRaw) : undefined;
  if (!order) {
    logClaimFail("order_not_found", { tokenId: null, eventId: null, ipHash });
    return jsonNoStore({ ok: false, reason: "order_not_found", error: "Order not found" }, { status: 404 });
  }
  if (order.payment_status !== "paid") {
    logClaimFail("order_not_paid", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "order_not_paid", error: "Order not paid" }, { status: 400 });
  }

  if (typeof payload?.walletAddress !== "string" || !isAddress(payload.walletAddress)) {
    logClaimFail("invalid_wallet", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore(
      { ok: false, reason: "invalid_wallet", error: "Valid walletAddress is required" },
      { status: 400 }
    );
  }

  if (payload?.tokenId && order.tokenId && payload.tokenId.trim() !== order.tokenId) {
    logClaimFail("not_owner", { tokenId: order.tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "not_owner", error: "TokenId does not match order" }, { status: 403 });
  }

  const walletAddress = getAddress(payload.walletAddress);
  const mintMode = resolveMintModeFromOrder(order);
  const tokenId = order.tokenId ?? (payload?.tokenId?.trim() || null);
  const nftAddress = order.nftAddress ?? null;

  if (!RPC_URL) {
    logClaimFail("server_misconfigured", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash }, {
      missingEnv: "RPC_URL",
    });
    return jsonNoStore({ ok: false, reason: "server_misconfigured", error: "Server misconfigured" }, { status: 500 });
  }

  if (!tokenId || !nftAddress) {
    logClaimFail("not_ready", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "not_ready", error: "Order not ready for claim" }, { status: 400 });
  }

  const provider = new JsonRpcProvider(RPC_URL);
  let onchainOwner: string | null = null;
  try {
    onchainOwner = await getOnchainOwner({ tokenId, nftAddress }, provider);
  } catch {
    logClaimFail("not_ready", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "not_ready", error: "Unable to verify onchain owner" }, { status: 500 });
  }

  if (onchainOwner && onchainOwner === walletAddress) {
    if (order.ticketState !== "gate_validated") {
      const now = new Date().toISOString();
      const incomingClaimCode = payload.claimCode?.trim() || null;
      const resolvedClaimCode = order.claimCode ?? incomingClaimCode;
      const resolvedClaimCodeHash =
        order.claimCodeHash ?? (incomingClaimCode ? hashClaimCode(incomingClaimCode) : null);
      const resolvedClaimCodeCreatedAt =
        order.claimCodeCreatedAt ?? (incomingClaimCode ? now : null);
      const updated = applyAtLeastTransition(order, "claimed", {
        claimStatus: "claimed",
        claimedTo: walletAddress,
        claimedAt: order.claimedAt ?? now,
        claimCode: resolvedClaimCode ?? null,
        claimCodeHash: resolvedClaimCodeHash ?? null,
        claimCodeCreatedAt: resolvedClaimCodeCreatedAt ?? null,
      });
      await persistOrder(updated);
    }

    logClaimSuccess({ tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore(
      {
        ok: true,
        status: "not_required",
        message: "Ticket already owned by buyer; no claim needed",
        claimed: true,
      },
      { status: 200 }
    );
  }

  if (mintMode === "direct") {
    logClaimFail("not_owner", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore(
      { ok: false, reason: "not_owner", error: "Ticket is owned by a different wallet" },
      { status: 403 }
    );
  }

  if (order.ticketState === "claimed" || order.ticketState === "gate_validated") {
    const claimedTo = order.claimedTo ? getAddress(order.claimedTo) : null;
    if (claimedTo && claimedTo !== walletAddress) {
      logClaimFail("not_owner", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
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
    logClaimFail("already_claimed", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
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
  if (order.ticketState !== "minted" && order.ticketState !== "claimable") {
    logClaimFail("not_ready", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "not_ready", error: "Order not ready for claim" }, { status: 400 });
  }

  const custodyAddress = order.custodyAddress ?? env.CUSTODY_WALLET_ADDRESS ?? null;
  if (!custodyAddress) {
    logClaimFail("server_misconfigured", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash }, {
      missingEnv: "CUSTODY_WALLET_ADDRESS",
    });
    return jsonNoStore({ ok: false, reason: "server_misconfigured", error: "Server misconfigured" }, { status: 500 });
  }
  const normalizedCustodyAddress = getAddress(custodyAddress);
  if (onchainOwner && onchainOwner !== normalizedCustodyAddress) {
    logClaimFail("not_owner", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore(
      { ok: false, reason: "not_owner", error: "Ticket is owned by a different wallet" },
      { status: 403 }
    );
  }

  if (typeof payload?.claimCode !== "string" || !payload.claimCode.trim()) {
    logClaimFail("missing_claim_code", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore(
      { ok: false, reason: "missing_claim_code", error: "Claim code is required for custody mint" },
      { status: 400 }
    );
  }

  if (order.claimExpiresAt) {
    const expiresAt = Date.parse(order.claimExpiresAt);
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
      logClaimFail("claim_expired", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
      return jsonNoStore({ ok: false, reason: "claim_expired", error: "Claim expired" }, { status: 410 });
    }
  }

  let claimCodeMatches = false;
  if (order.claimCode) {
    const requestCode = payload.claimCode.trim();
    const orderCode = order.claimCode;
    const requestUpper = requestCode.toUpperCase();
    const orderUpper = orderCode.toUpperCase();
    if (isFormattedClaimCode(requestUpper) && isFormattedClaimCode(orderUpper)) {
      const normalizedRequest = normalizeFormattedClaimCode(requestUpper);
      const normalizedOrder = normalizeFormattedClaimCode(orderUpper);
      const computedBuffer = Buffer.from(normalizedRequest, "utf8");
      const storedBuffer = Buffer.from(normalizedOrder, "utf8");
      claimCodeMatches =
        computedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(computedBuffer, storedBuffer);
    } else {
      const computedBuffer = Buffer.from(requestCode, "utf8");
      const storedBuffer = Buffer.from(orderCode, "utf8");
      claimCodeMatches =
        computedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(computedBuffer, storedBuffer);
    }
  } else if (order.claimCodeHash) {
    const computed = hashClaimCode(payload.claimCode);
    const computedBuffer = Buffer.from(computed, "utf8");
    const storedBuffer = Buffer.from(order.claimCodeHash, "utf8");
    claimCodeMatches =
      computedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(computedBuffer, storedBuffer);
  }

  if (!order.claimCode && !order.claimCodeHash) {
    logClaimFail("not_ready", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    return jsonNoStore({ ok: false, reason: "not_ready", error: "Order not ready for claim" }, { status: 400 });
  }

  const claimRateKey = `${route}:${ip}:${tokenId ?? order.merchantOrderId}`;
  const claimRate = claimTokenLimiter(claimRateKey);
  if (!claimRate.ok) {
    const retryAfter = Math.ceil(claimRate.retryAfterMs / 1000);
    logClaimFail("rate_limited", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    emitMetric(
      "rate_limit_hit",
      { route, ip, reason: "rate_limit", latencyMs: Date.now() - startedAt }
    );
    return jsonNoStore(
      { ok: false, reason: "rate_limited", error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (!claimCodeMatches) {
    logClaimFail("invalid_code", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
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

  if (hasKv) {
    lockKey = `claim:lock:${tokenId ?? order.merchantOrderId}`;
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
      const contract = new Contract(getAddress(nftAddress), eventTicketClaimAbi, provider);
      const onchainPaymentId = (await contract.paymentIdOf(BigInt(tokenId))) as string;
      if (onchainPaymentId.toLowerCase() !== expectedPaymentId.toLowerCase()) {
        logClaimFail("invalid_code", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
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

  const custodyKeyRaw = process.env.CUSTODY_WALLET_PRIVATE_KEY;
  if (!custodyKeyRaw) {
    logClaimFail("server_misconfigured", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash }, {
      missingEnv: "CUSTODY_WALLET_PRIVATE_KEY",
    });
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return jsonNoStore({ ok: false, reason: "server_misconfigured", error: "Server misconfigured" }, { status: 500 });
  }
  const custodyKey = custodyKeyRaw.startsWith("0x") ? custodyKeyRaw : `0x${custodyKeyRaw}`;
  const signer = new Wallet(custodyKey, provider);
  if (getAddress(signer.address) !== normalizedCustodyAddress) {
    logClaimFail("server_misconfigured", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash }, {
      custodyAddressMismatch: true,
    });
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return jsonNoStore({ ok: false, reason: "server_misconfigured", error: "Server misconfigured" }, { status: 500 });
  }

  await checkRelayerGasBalance(custodyKeyRaw);

  try {
    const contract = new Contract(getAddress(nftAddress), eventTicketClaimAbi, signer);
    let chainClaimed = false;
    let chainClaimTxHash: string | null = null;
    let chainClaimError: string | null = null;

    try {
      const claimTx = await contract.claim(BigInt(tokenId));
      chainClaimTxHash = claimTx.hash;
      await claimTx.wait(1);
      chainClaimed = true;
    } catch (error) {
      chainClaimError = error instanceof Error ? error.message : "Unknown error";
      chainClaimed = false;
    }

    let transferTx;
    try {
      transferTx = await contract.safeTransferFrom(normalizedCustodyAddress, walletAddress, BigInt(tokenId));
    } catch {
      transferTx = await contract.transferFrom(normalizedCustodyAddress, walletAddress, BigInt(tokenId));
    }
    await transferTx.wait(1);

    const txHash = transferTx.hash as string;
    await markOrderClaimed({
      merchantOrderId: order.merchantOrderId,
      claimedTo: walletAddress,
      claimedAt: new Date().toISOString(),
      txHash,
      chainClaimed,
      chainClaimTxHash,
      chainClaimError,
    });

    logClaimSuccess({ tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
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
      txHash,
      transferTxHash: txHash,
      tokenId,
      claimed: true,
      claimedTo: walletAddress,
      mintMode: "custody",
      chainClaimed,
      ...(debugEnabled && chainClaimTxHash ? { chainClaimTxHash } : {}),
      ...(debugEnabled && chainClaimError ? { chainClaimError } : {}),
    });
  } catch {
    logClaimFail("claim_failed", { tokenId: tokenId ?? null, eventId: order.eventId ?? null, ipHash });
    if (lockKey) {
      await kv.del(lockKey).catch(() => {});
    }
    return jsonNoStore({ ok: false, reason: "claim_failed", error: "Claim failed" }, { status: 500 });
  }
}
