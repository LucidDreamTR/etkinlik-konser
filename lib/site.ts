import { getAddress } from "viem";

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
  const publicValue = process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS?.trim();
  const serverValue = options?.server ? process.env.TICKET_CONTRACT_ADDRESS?.trim() : undefined;
  const raw = publicValue || serverValue;
  if (!raw) {
    throw new Error("Missing env: NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS");
  }
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  return getAddress(normalized);
}
