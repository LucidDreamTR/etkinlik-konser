import crypto from "crypto";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { normalizeSplitSlug } from "@/lib/events";
import { getOrderByMerchantId, recordPaidOrder } from "@/src/lib/ordersStore";
import { purchaseOnchain } from "@/src/server/onchainPurchase";

export type PaymentPayload = {
  merchantOrderId: string;
  eventId: string | number | bigint;
  splitSlug: string;
  buyerAddress?: string | null;
  amountTry: string | number | bigint;
  amountWei?: string | number | bigint;
};

export type PaymentResult =
  | { ok: true; status: "processed"; txHash: string; claimCode?: string }
  | { ok: true; status: "duplicate"; txHash: string; message: string }
  | { ok: true; status: "pending"; message: string };

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

export async function processPayment(
  payload: PaymentPayload,
  options: { allowPendingToProcess?: boolean } = {}
): Promise<PaymentResult> {
  const merchantOrderId = normalizeString(payload.merchantOrderId, "merchantOrderId");
  const splitSlug = normalizeSplitSlug(normalizeString(payload.splitSlug, "splitSlug"));
  const buyerAddress = payload.buyerAddress ?? null;

  const existing = await getOrderByMerchantId(merchantOrderId);
  if (existing) {
    if (existing.txHash) {
      return { ok: true, status: "duplicate", txHash: existing.txHash, message: "Already processed" };
    }
    if (!options.allowPendingToProcess) {
      return { ok: true, status: "pending", message: "Paid but on-chain pending" };
    }
  }

  const onchain = await purchaseOnchain({
    merchantOrderId,
    splitSlug,
    eventId: payload.eventId,
    amountTry: normalizeAmount(payload.amountTry),
    amountWei: payload.amountWei,
    buyerAddress,
  });

  const custodyAddress = buyerAddress ? null : resolveCustodyAddress();
  const shouldIssueClaimCode = buyerAddress === null && !existing?.claimCodeHash;
  const claimCode = shouldIssueClaimCode ? crypto.randomBytes(32).toString("base64url") : null;
  const claimCodeHash =
    claimCode !== null ? crypto.createHash("sha256").update(claimCode).digest("hex") : null;
  const claimedAt = buyerAddress ? new Date().toISOString() : null;

  await recordPaidOrder({
    merchantOrderId,
    splitSlug,
    eventId: normalizeEventId(payload.eventId),
    amountTry: normalizeAmount(payload.amountTry),
    buyerAddress,
    txHash: onchain.txHash,
    tokenId: onchain.tokenId,
    nftAddress: onchain.nftAddress,
    custodyAddress,
    claimCodeHash,
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

  const privateKeyRaw = process.env.RELAYER_PRIVATE_KEY;
  if (!privateKeyRaw) {
    throw new Error("Missing RELAYER_PRIVATE_KEY for custody address");
  }
  const privateKey = (privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`;
  return privateKeyToAccount(privateKey).address;
}
