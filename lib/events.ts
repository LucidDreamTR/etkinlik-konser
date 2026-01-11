import { keccak256, toBytes, type Hex } from "viem";

import { normalizeSlug } from "@/lib/slug";

export type PayoutRole = "artist" | "organizer" | "venue" | "platform" | "partner";

export type PayoutSplit = {
  role: PayoutRole;
  label?: string;
  recipient: string;
  shareBps: number; // basis points: 10000 = %100
};

export type EventRecord = {
  slug: string;
  planId: string;
  splitId: Hex;
  priceWei: string;
  maxSupply: number;
  paused: boolean;
  baseURI: string;
  title: string;
  description: string;

  date?: string;
  location?: string;

  dateLabel?: string;
  cityLabel?: string;

  venueName?: string;
  venueAddress?: string;
  doorsOpenLabel?: string;
  startTimeLabel?: string;

  organizerName?: string;
  organizerHandle?: string;

  status?: "upcoming" | "live" | "ended";
  tags?: string[];

  ticket?: {
    priceTryLabel: string;
    supplyLabel?: string;
    saleStatus: "soon" | "on" | "soldout";
  };

  ticketPriceWei?: string;

  coverImageSrc?: string;

  payouts: PayoutSplit[];
};

function isBytes32Hex(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function normalizeSplitSlug(value: string): string {
  return normalizeSlug(value);
}

export function buildSplitId(value: string): Hex {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("splitSlug gerekli");
  if (isBytes32Hex(trimmed)) return trimmed;
  const normalized = normalizeSplitSlug(trimmed);
  return keccak256(toBytes(normalized));
}
