import { promises as fs } from "fs";
import path from "path";

export type PaymentStatus = "paid" | "pending" | "failed" | string;
export type ClaimStatus = "unclaimed" | "claimed";

export type PaymentOrder = {
  merchantOrderId: string;
  orderId?: string | null;
  eventId: string;
  splitSlug: string;
  buyerAddress?: string | null;
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
  createdAt: string;
  updatedAt: string;
};

const STORE_PATH = path.join(process.cwd(), "data", "orders.json");
const isProd = process.env.NODE_ENV === "production";
const inMemoryOrders: PaymentOrder[] = [];

async function readStore(): Promise<PaymentOrder[]> {
  if (isProd) {
    return inMemoryOrders;
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
    // Vercel serverless filesystem is read-only.
    inMemoryOrders.length = 0;
    inMemoryOrders.push(...orders);
    return;
  }
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const tmpPath = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(orders, null, 2) + "\n", "utf8");
  await fs.rename(tmpPath, STORE_PATH);
}

export async function getOrderByMerchantId(merchantOrderId: string): Promise<PaymentOrder | undefined> {
  const orders = await readStore();
  return orders.find((order) => order.merchantOrderId === merchantOrderId);
}

export async function recordPaidOrder(
  order: Omit<PaymentOrder, "payment_status" | "createdAt" | "updatedAt">
): Promise<{
  order: PaymentOrder;
  created: boolean;
}> {
  const orders = await readStore();
  const existing = orders.find((entry) => entry.merchantOrderId === order.merchantOrderId);
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
      existing.updatedAt = new Date().toISOString();
      await writeStore(orders);
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

  orders.push(createdOrder);
  await writeStore(orders);
  return { order: createdOrder, created: true };
}

export async function recordOrderStatus(
  order: Omit<
    PaymentOrder,
    "createdAt" | "updatedAt" | "txHash" | "tokenId" | "nftAddress" | "custodyAddress" | "claimCodeHash" | "claimExpiresAt" | "claimStatus" | "claimedTo" | "claimedAt"
  >
): Promise<{ order: PaymentOrder; created: boolean }> {
  const orders = await readStore();
  const existing = orders.find((entry) => entry.merchantOrderId === order.merchantOrderId);
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
    claimStatus: null,
    claimedTo: null,
    claimedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  orders.push(createdOrder);
  await writeStore(orders);
  return { order: createdOrder, created: true };
}

export async function markOrderClaimed(args: {
  merchantOrderId: string;
  claimedTo: string;
  claimedAt: string;
  txHash: string;
}): Promise<PaymentOrder> {
  const orders = await readStore();
  const existing = orders.find((entry) => entry.merchantOrderId === args.merchantOrderId);
  if (!existing) {
    throw new Error("Order not found");
  }

  existing.claimStatus = "claimed";
  existing.claimedTo = args.claimedTo;
  existing.claimedAt = args.claimedAt;
  existing.txHash = existing.txHash ?? args.txHash;
  existing.updatedAt = new Date().toISOString();
  await writeStore(orders);
  return existing;
}
