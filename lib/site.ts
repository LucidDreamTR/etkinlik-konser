import "server-only";

import { getChainConfig } from "@/src/lib/chain";

export function getPublicBaseUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  throw new Error("Missing public base URL (NEXT_PUBLIC_SITE_URL or VERCEL_URL)");
}

export function getMetadataBase(): URL {
  return new URL(getPublicBaseUrl());
}

export function getTicketContractAddress(options?: { server?: boolean }): `0x${string}` {
  const chain = getChainConfig();
  if (!chain.ticketContractAddress) {
    throw new Error("Missing ticket contract address for selected network.");
  }
  return chain.ticketContractAddress;
}
