import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";

import {
  applyAtLeastTransition,
  applyTransition,
  ensureTicketState,
  TicketState,
  TicketStateTransitionError,
} from "@/src/lib/ticketLifecycle";

export type PaymentStatus = "paid" | "pending" | "failed" | string;
export type ClaimStatus = "unclaimed" | "claimed";
export type PurchaseStatus = "pending" | "processed" | "duplicate";

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
  purchaseStatus?: PurchaseStatus | null;
  ticketState?: TicketState | null;
  txHash?: string | null;
  intentSignature?: string | null;
  intentDeadline?: string | null;
  intentAmountWei?: string | null;
  tokenId?: string | null;
  nftAddress?: string | null;
  custodyAddress?: string | null;
  claimCodeHash?: string | null;
  claimCode?: string | null;
  claimCodeCreatedAt?: string | null;
  claimExpiresAt?: string | null;
  claimStatus?: ClaimStatus | null;
  claimedTo?: string | null;
  claimedAt?: string | null;
  chainClaimed?: boolean | null;
  chainClaimTxHash?: string | null;
  chainClaimError?: string | null;
  usedAt?: string | null;
  usedBy?: string | null;
  gateValidatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const STORE_PATH = path.join(process.cwd(), "data", "orders.json");
const USED_STORE_PATH = path.join(process.cwd(), "data", "used.json");
const isProd = process.env.NODE_ENV === "production";
const ORDER_KEY_PREFIX = "order:";
const TOKEN_INDEX_PREFIX = "order:token:";
const USED_KEY_PREFIX = "used:token:";
const USED_EVENT_PREFIX = "used:event:";

function orderKey(merchantOrderId: string): string {
  return `${ORDER_KEY_PREFIX}${merchantOrderId}`;
}

function tokenIndexKey(tokenId: string): string {
  return `${TOKEN_INDEX_PREFIX}${tokenId}`;
}

function usedKey(tokenId: string): string {
  return `${USED_KEY_PREFIX}${tokenId}`;
}

function usedEventKey(eventId: string, tokenId: string): string {
  return `${USED_EVENT_PREFIX}${eventId}:token:${tokenId}`;
}

function withTicketState(order: PaymentOrder): PaymentOrder {
  return ensureTicketState(order);
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

async function readUsedStore(): Promise<Record<string, { usedAt: string; owner?: string | null; eventId?: string | null }>> {
  if (isProd) {
    throw new Error("readUsedStore() should not be used in production; use KV-backed accessors.");
  }
  try {
    const raw = await fs.readFile(USED_STORE_PATH, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, { usedAt: string; owner?: string | null; eventId?: string | null }>;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      await writeUsedStore({});
      return {};
    }
    throw error;
  }
}

async function writeUsedStore(
  used: Record<string, { usedAt: string; owner?: string | null; eventId?: string | null }>
): Promise<void> {
  if (isProd) {
    throw new Error("writeUsedStore() should not be used in production; use KV-backed accessors.");
  }
  await fs.mkdir(path.dirname(USED_STORE_PATH), { recursive: true });
  const tmpPath = `${USED_STORE_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(used, null, 2) + "\n", "utf8");
  await fs.rename(tmpPath, USED_STORE_PATH);
}

export async function getOrderByMerchantId(merchantOrderId: string): Promise<PaymentOrder | undefined> {
  if (isProd) {
    ensureKvConfigured();
    const stored = await kv.get<PaymentOrder>(orderKey(merchantOrderId));
    return stored ? withTicketState(stored) : undefined;
  }
  const orders = await readStore();
  const found = orders.find((order) => order.merchantOrderId === merchantOrderId);
  return found ? withTicketState(found) : undefined;
}

export async function getOrderByTokenId(tokenId: string): Promise<PaymentOrder | undefined> {
  if (isProd) {
    ensureKvConfigured();
    const merchantOrderId = await kv.get<string>(tokenIndexKey(tokenId));
    if (!merchantOrderId) return undefined;
    const stored = await kv.get<PaymentOrder>(orderKey(merchantOrderId));
    return stored ? withTicketState(stored) : undefined;
  }
  const orders = await readStore();
  const found = orders.find((order) => order.tokenId === tokenId);
  return found ? withTicketState(found) : undefined;
}

async function saveOrder(order: PaymentOrder): Promise<void> {
  const normalized = withTicketState(order);
  if (isProd) {
    ensureKvConfigured();
    await kv.set(orderKey(normalized.merchantOrderId), normalized);
    if (normalized.tokenId) {
      await kv.set(tokenIndexKey(normalized.tokenId), normalized.merchantOrderId);
    }
    return;
  }
  const orders = await readStore();
  const index = orders.findIndex((entry) => entry.merchantOrderId === normalized.merchantOrderId);
  if (index >= 0) {
    orders[index] = normalized;
  } else {
    orders.push(normalized);
  }
  await writeStore(orders);
}

export async function persistOrder(order: PaymentOrder): Promise<PaymentOrder> {
  await saveOrder(order);
  return order;
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
      const updated = applyAtLeastTransition(existing, "minted", {
        txHash: order.txHash,
        orderId: order.orderId ?? existing.orderId ?? null,
        payment_status: "paid",
        purchaseStatus: "processed",
        intentSignature: order.intentSignature ?? existing.intentSignature ?? null,
        intentDeadline: order.intentDeadline ?? existing.intentDeadline ?? null,
        intentAmountWei: order.intentAmountWei ?? existing.intentAmountWei ?? null,
        tokenId: order.tokenId ?? existing.tokenId ?? null,
        nftAddress: order.nftAddress ?? existing.nftAddress ?? null,
        custodyAddress: order.custodyAddress ?? existing.custodyAddress ?? null,
        claimCodeHash: order.claimCodeHash ?? existing.claimCodeHash ?? null,
        claimCode: order.claimCode ?? existing.claimCode ?? null,
        claimCodeCreatedAt: order.claimCodeCreatedAt ?? existing.claimCodeCreatedAt ?? null,
        claimExpiresAt: order.claimExpiresAt ?? existing.claimExpiresAt ?? null,
        claimStatus: order.claimStatus ?? existing.claimStatus ?? null,
        claimedTo: order.claimedTo ?? existing.claimedTo ?? null,
        claimedAt: order.claimedAt ?? existing.claimedAt ?? null,
        chainClaimed: order.chainClaimed ?? existing.chainClaimed ?? null,
        chainClaimTxHash: order.chainClaimTxHash ?? existing.chainClaimTxHash ?? null,
        chainClaimError: order.chainClaimError ?? existing.chainClaimError ?? null,
        usedAt: order.usedAt ?? existing.usedAt ?? null,
        usedBy: order.usedBy ?? existing.usedBy ?? null,
      });
      await saveOrder(updated);
      return { order: updated, created: false };
    }
    return { order: existing, created: false };
  }

  const now = new Date().toISOString();
  const createdOrder: PaymentOrder = applyTransition(
    {
      ...order,
      payment_status: "paid",
      purchaseStatus: "processed",
      createdAt: now,
      updatedAt: now,
      ticketState: order.tokenId ? "minted" : "paid",
    },
    order.tokenId ? "minted" : "paid"
  );

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
      | "claimCode"
      | "claimCodeCreatedAt"
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
    return { order: withTicketState(existing), created: false };
  }

  const now = new Date().toISOString();
  const createdOrder: PaymentOrder = applyTransition(
    {
      ...order,
      txHash: null,
      tokenId: null,
      nftAddress: null,
      custodyAddress: null,
      claimCodeHash: null,
      claimCode: null,
      claimCodeCreatedAt: null,
      claimExpiresAt: null,
      claimStatus: "unclaimed",
      claimedTo: null,
      claimedAt: null,
      chainClaimed: null,
      chainClaimTxHash: null,
      chainClaimError: null,
      usedAt: null,
      usedBy: null,
      gateValidatedAt: null,
      purchaseStatus: order.purchaseStatus ?? null,
      ticketState: "intent_created",
      createdAt: now,
      updatedAt: now,
    },
    "intent_created"
  );

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

  try {
    const updated = applyAtLeastTransition(existing, "claimed", {
      claimStatus: "claimed",
      claimedTo: args.claimedTo,
      claimedAt: args.claimedAt,
      txHash: existing.txHash ?? args.txHash,
      chainClaimed: args.chainClaimed ?? existing.chainClaimed ?? null,
      chainClaimTxHash: args.chainClaimTxHash ?? existing.chainClaimTxHash ?? null,
      chainClaimError: args.chainClaimError ?? existing.chainClaimError ?? null,
    });
    await saveOrder(updated);
    return updated;
  } catch (error) {
    if (error instanceof TicketStateTransitionError) {
      throw error;
    }
    throw error;
  }
}

export async function markTokenUsedOnce(args: {
  tokenId: string;
  owner?: string | null;
  eventId?: string | null;
}): Promise<{ alreadyUsed: boolean; usedAt: string }> {
  if (!args.eventId) {
    throw new Error("Missing eventId for token use");
  }
  const usedAt = new Date().toISOString();
  if (isProd) {
    ensureKvConfigured();
    const eventScopedKey = usedEventKey(args.eventId, args.tokenId);
    const legacyKey = usedKey(args.tokenId);
    const legacy = await kv.get<{ usedAt?: string; owner?: string | null; eventId?: string | null }>(legacyKey);
    if (legacy) {
      await kv.set(
        eventScopedKey,
        { usedAt: legacy.usedAt ?? usedAt, owner: legacy.owner ?? args.owner ?? null, eventId: args.eventId },
        { nx: true }
      );
      return { alreadyUsed: true, usedAt: legacy.usedAt ?? usedAt };
    }

    const result = await kv.set(
      eventScopedKey,
      { usedAt, owner: args.owner ?? null, eventId: args.eventId },
      { nx: true }
    );
    if (result === null) {
      return { alreadyUsed: true, usedAt };
    }
    return { alreadyUsed: false, usedAt };
  }

  const used = await readUsedStore();
  const legacyKey = args.tokenId;
  const eventScopedKey = usedEventKey(args.eventId, args.tokenId);
  const legacy = used[legacyKey];
  if (legacy) {
    used[eventScopedKey] = used[eventScopedKey] ?? {
      usedAt: legacy.usedAt ?? usedAt,
      owner: legacy.owner ?? args.owner ?? null,
      eventId: args.eventId,
    };
    await writeUsedStore(used);
    return { alreadyUsed: true, usedAt: legacy.usedAt ?? usedAt };
  }
  if (used[eventScopedKey]) {
    return { alreadyUsed: true, usedAt: used[eventScopedKey].usedAt };
  }
  used[eventScopedKey] = { usedAt, owner: args.owner ?? null, eventId: args.eventId };
  await writeUsedStore(used);
  return { alreadyUsed: false, usedAt };
}
