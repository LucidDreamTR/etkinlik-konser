import crypto from "crypto";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { normalizeSplitSlug } from "@/lib/events";
import { getOrderByMerchantId, recordPaidOrder } from "@/src/lib/ordersStore";
import { computeOrderId } from "@/src/server/orderId";
import { purchaseWithFiat } from "@/src/server/fiatPurchase";

export type PaymentPayload = {
  merchantOrderId: string;
  orderId?: `0x${string}`;
  eventId: string | number | bigint;
  splitSlug: string;
  buyerAddress?: string | null;
  amountTry: string | number | bigint;
  amountWei?: string | number | bigint;
};

export type PaymentResult =
  | { ok: true, status: "processed", txHash: string, claimCode?: string }
  | { ok: true, status: "duplicate", txHash: string, message: string }
  | { ok: true, status: "pending", message: string };

function normalizeString(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} string olmalı`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} boş olamaz`);
  return trimmed;
}

function normalizeAmount(value: PaymentPayload["amountTry"]): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return value.toString();
}

function normalizeEventId(value: PaymentPayload["eventId"]): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return value.toString();
}

function normalizeBuyerAddress(value: PaymentPayload["buyerAddress"], fallback: `0x${string}`): `0x${string}` {
  if (!value) return fallback;
  if (typeof value !== "string") throw new Error("buyerAddress string olmalı");
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return getAddress(normalized);
}

function getChainId(): number {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
  return Number.isFinite(chainId) ? chainId : 31337;
}

export async function processPayment(
  payload: PaymentPayload,
  options: { allowPendingToProcess?: boolean } = {}
): Promise<PaymentResult> {
  const merchantOrderId = normalizeString(payload.merchantOrderId, "merchantOrderId");
  const splitSlug = normalizeSplitSlug(normalizeString(payload.splitSlug, "splitSlug"));
  const buyerAddress = payload.buyerAddress ?? null;
  const eventIdNormalized = normalizeEventId(payload.eventId);
  const custodyAddressResolved = resolveCustodyAddress();
  const resolvedBuyer = normalizeBuyerAddress(buyerAddress, custodyAddressResolved);
  const orderId =
    payload.orderId ??
    computeOrderId({
      paymentIntentId: merchantOrderId,
      buyer: resolvedBuyer,
      eventId: BigInt(eventIdNormalized),
      chainId: getChainId(),
    });

  const existing = await getOrderByMerchantId(merchantOrderId);
  if (existing) {
    if (existing.txHash) {
      return { ok: true, status: "duplicate", txHash: existing.txHash, message: "Already processed" };
    }
    if (!options.allowPendingToProcess) {
      return { ok: true, status: "pending", message: "Paid but on-chain pending" };
    }
  }

  // A placeholder for the metadata URI. In a real application, you would
  // generate this based on event details, possibly pointing to an API route
  // that serves EIP-721 compliant metadata.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const tokenUri = `${appUrl}/api/metadata/ticket/${eventIdNormalized}`;
  if (process.env.NODE_ENV !== "production" && !tokenUri) {
    throw new Error("tokenUri missing");
  }

  const onchain = await purchaseWithFiat({
    merchantOrderId,
    eventId: payload.eventId,
    buyerAddress: resolvedBuyer,
    uri: tokenUri,
  });

  if ("alreadyUsed" in onchain && onchain.alreadyUsed) {
    return { ok: true, status: "duplicate", txHash: existing?.txHash ?? "", message: "Order already used" };
  }

  const custodyAddress = buyerAddress ? null : custodyAddressResolved;
  const shouldIssueClaimCode = buyerAddress === null && !existing?.claimCodeHash;
  const claimCode = shouldIssueClaimCode ? crypto.randomBytes(32).toString("base64url") : null;
  const claimCodeHash =
    claimCode !== null ? crypto.createHash("sha256").update(claimCode).digest("hex") : null;
  const claimedAt = buyerAddress ? new Date().toISOString() : null;
  const ttlSecondsRaw = Number(process.env.CLAIM_TTL_SECONDS ?? 86400);
  const ttlSeconds = Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0 ? ttlSecondsRaw : 86400;
  const claimExpiresAt = claimCode ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;

  await recordPaidOrder({
    merchantOrderId,
    orderId,
    splitSlug,
    eventId: eventIdNormalized,
    amountTry: normalizeAmount(payload.amountTry),
    buyerAddress,
    txHash: onchain.txHash,
    tokenId: onchain.tokenId,
    nftAddress: onchain.nftAddress,
    custodyAddress,
    claimCodeHash,
    claimExpiresAt,
    claimStatus: buyerAddress ? "claimed" : "unclaimed",
    claimedTo: buyerAddress,
    claimedAt,
  });

  return { ok: true, status: "processed", txHash: onchain.txHash, ...(claimCode ? { claimCode } : {}) };
}

function resolveCustodyAddress(): `0x${string}` {
  const custodyEnv = process.env.CUSTODY_ADDRESS;
  if (custodyEnv) {
    return getAddress(custodyEnv.startsWith("0x") ? custodyEnv : `0x${custodyEnv}`);
  }

  // Use the new BACKEND_WALLET_PRIVATE_KEY for the custody/minter wallet
  const privateKeyRaw = process.env.BACKEND_WALLET_PRIVATE_KEY;
  if (!privateKeyRaw) {
    throw new Error("Missing BACKEND_WALLET_PRIVATE_KEY for custody address");
  }
  const privateKey = (privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`;
  return privateKeyToAccount(privateKey).address;
}
