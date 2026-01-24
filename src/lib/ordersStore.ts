import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";

export type PaymentStatus = "paid" | "pending" | "failed" | string;
export type ClaimStatus = "unclaimed" | "claimed";

export type PaymentOrder = {
  merchantOrderId: string;
  orderId?: string | null;
  orderNonce?: string | null;
  eventId: string;
  splitSlug: string;
  buyerAddress?: string | null;
  ticketType?: string | null;
  seat?: string | null;
  paymentPreimage?: string | null;
  amountTry: string;
  payment_status: PaymentStatus;
  txHash?: string | null;
  intentSignature?: string | null;
  intentDeadline?: string | null;
  intentAmountWei?: string | null;
  tokenId?: string | null;
  nftAddress?: string | null;
  custodyAddress?: string | null;
  claimCodeHash?: string | null;
  claimExpiresAt?: string | null;
  claimStatus?: ClaimStatus | null;
  claimedTo?: string | null;
  claimedAt?: string | null;
  chainClaimed?: boolean | null;
  chainClaimTxHash?: string | null;
  chainClaimError?: string | null;
  createdAt: string;
  updatedAt: string;
};

const STORE_PATH = path.join(process.cwd(), "data", "orders.json");
const isProd = process.env.NODE_ENV === "production";
const ORDER_KEY_PREFIX = "order:";
const TOKEN_INDEX_PREFIX = "order:token:";

function orderKey(merchantOrderId: string): string {
  return `${ORDER_KEY_PREFIX}${merchantOrderId}`;
}

function tokenIndexKey(tokenId: string): string {
  return `${TOKEN_INDEX_PREFIX}${tokenId}`;
}

function ensureKvConfigured(): void {
  const hasUrl = Boolean(process.env.KV_REST_API_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN);
  if (!hasUrl || !hasToken) {
    throw new Error("Missing KV_REST_API_URL or KV_REST_API_TOKEN for production orders store");
  }
}

async function readStore(): Promise<PaymentOrder[]> {
  if (isProd) {
    throw new Error("readStore() should not be used in production; use KV-backed accessors.");
  }
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    if (!raw.trim()) return [];
    return JSON.parse(raw) as PaymentOrder[];
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      await writeStore([]);
      return [];
    }
    throw error;
  }
}

async function writeStore(orders: PaymentOrder[]): Promise<void> {
  if (isProd) {
    throw new Error("writeStore() should not be used in production; use KV-backed accessors.");
  }
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const tmpPath = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(orders, null, 2) + "\n", "utf8");
  await fs.rename(tmpPath, STORE_PATH);
}

export async function getOrderByMerchantId(merchantOrderId: string): Promise<PaymentOrder | undefined> {
  if (isProd) {
    ensureKvConfigured();
    const stored = await kv.get<PaymentOrder>(orderKey(merchantOrderId));
    return stored ?? undefined;
  }
  const orders = await readStore();
  return orders.find((order) => order.merchantOrderId === merchantOrderId);
}

export async function getOrderByTokenId(tokenId: string): Promise<PaymentOrder | undefined> {
  if (isProd) {
    ensureKvConfigured();
    const merchantOrderId = await kv.get<string>(tokenIndexKey(tokenId));
    if (!merchantOrderId) return undefined;
    const stored = await kv.get<PaymentOrder>(orderKey(merchantOrderId));
    return stored ?? undefined;
  }
  const orders = await readStore();
  return orders.find((order) => order.tokenId === tokenId);
}

async function saveOrder(order: PaymentOrder): Promise<void> {
  if (isProd) {
    ensureKvConfigured();
    await kv.set(orderKey(order.merchantOrderId), order);
    if (order.tokenId) {
      await kv.set(tokenIndexKey(order.tokenId), order.merchantOrderId);
    }
    return;
  }
  const orders = await readStore();
  const index = orders.findIndex((entry) => entry.merchantOrderId === order.merchantOrderId);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.push(order);
  }
  await writeStore(orders);
}

export async function recordPaidOrder(
  order: Omit<PaymentOrder, "payment_status" | "createdAt" | "updatedAt">
): Promise<{
  order: PaymentOrder;
  created: boolean;
}> {
  const existing = await getOrderByMerchantId(order.merchantOrderId);
  if (existing) {
    if (!existing.txHash) {
      existing.txHash = order.txHash;
      existing.orderId = order.orderId ?? existing.orderId ?? null;
      existing.payment_status = "paid";
      existing.intentSignature = order.intentSignature ?? existing.intentSignature ?? null;
      existing.intentDeadline = order.intentDeadline ?? existing.intentDeadline ?? null;
      existing.intentAmountWei = order.intentAmountWei ?? existing.intentAmountWei ?? null;
      existing.tokenId = order.tokenId ?? existing.tokenId ?? null;
      existing.nftAddress = order.nftAddress ?? existing.nftAddress ?? null;
      existing.custodyAddress = order.custodyAddress ?? existing.custodyAddress ?? null;
      existing.claimCodeHash = order.claimCodeHash ?? existing.claimCodeHash ?? null;
      existing.claimExpiresAt = order.claimExpiresAt ?? existing.claimExpiresAt ?? null;
      existing.claimStatus = order.claimStatus ?? existing.claimStatus ?? null;
      existing.claimedTo = order.claimedTo ?? existing.claimedTo ?? null;
      existing.claimedAt = order.claimedAt ?? existing.claimedAt ?? null;
      existing.chainClaimed = order.chainClaimed ?? existing.chainClaimed ?? null;
      existing.chainClaimTxHash = order.chainClaimTxHash ?? existing.chainClaimTxHash ?? null;
      existing.chainClaimError = order.chainClaimError ?? existing.chainClaimError ?? null;
      existing.updatedAt = new Date().toISOString();
      await saveOrder(existing);
    }
    return { order: existing, created: false };
  }

  const now = new Date().toISOString();
  const createdOrder: PaymentOrder = {
    ...order,
    payment_status: "paid",
    createdAt: now,
    updatedAt: now,
  };

  await saveOrder(createdOrder);
  return { order: createdOrder, created: true };
}

export async function recordOrderStatus(
  order: Omit<
    PaymentOrder,
    "createdAt"
      | "updatedAt"
      | "txHash"
      | "tokenId"
      | "nftAddress"
      | "custodyAddress"
      | "claimCodeHash"
      | "claimExpiresAt"
      | "claimStatus"
      | "claimedTo"
      | "claimedAt"
      | "chainClaimed"
      | "chainClaimTxHash"
      | "chainClaimError"
  >
): Promise<{ order: PaymentOrder; created: boolean }> {
  const existing = await getOrderByMerchantId(order.merchantOrderId);
  if (existing) {
    return { order: existing, created: false };
  }

  const now = new Date().toISOString();
  const createdOrder: PaymentOrder = {
    ...order,
    txHash: null,
    tokenId: null,
    nftAddress: null,
    custodyAddress: null,
    claimCodeHash: null,
    claimExpiresAt: null,
    claimStatus: "unclaimed",
    claimedTo: null,
    claimedAt: null,
    chainClaimed: null,
    chainClaimTxHash: null,
    chainClaimError: null,
    createdAt: now,
    updatedAt: now,
  };

  await saveOrder(createdOrder);
  return { order: createdOrder, created: true };
}

export async function markOrderClaimed(args: {
  merchantOrderId: string;
  claimedTo: string;
  claimedAt: string;
  txHash: string;
  chainClaimed?: boolean | null;
  chainClaimTxHash?: string | null;
  chainClaimError?: string | null;
}): Promise<PaymentOrder> {
  const existing = await getOrderByMerchantId(args.merchantOrderId);
  if (!existing) {
    throw new Error("Order not found");
  }

  existing.claimStatus = "claimed";
  existing.claimedTo = args.claimedTo;
  existing.claimedAt = args.claimedAt;
  existing.txHash = existing.txHash ?? args.txHash;
  existing.chainClaimed = args.chainClaimed ?? existing.chainClaimed ?? null;
  existing.chainClaimTxHash = args.chainClaimTxHash ?? existing.chainClaimTxHash ?? null;
  existing.chainClaimError = args.chainClaimError ?? existing.chainClaimError ?? null;
  existing.updatedAt = new Date().toISOString();
  await saveOrder(existing);
  return existing;
}
