import { getAddress } from "viem";

import { getTicketContractAddress } from "@/lib/site";
import { getServerEnv } from "@/src/lib/env";

export function requireEnv(name: string): string {
  const env = getServerEnv() as Record<string, string | boolean | undefined>;
  const value = env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  if (typeof value !== "string") return String(value);
  return value;
}

export function requireAddressEnv(name: string): `0x${string}` {
  const value = requireEnv(name);
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return getAddress(normalized);
}

function requireAnyAddressEnv(names: string[]): `0x${string}` {
  for (const name of names) {
    const value = process.env[name];
    if (!value) continue;
    const normalized = value.startsWith("0x") ? value : `0x${value}`;
    return getAddress(normalized);
  }
  throw new Error(`Missing env: ${names.join(" or ")}`);
}

export function validateServerEnv(): void {
  getTicketContractAddress({ server: true });
  requireEnv("BACKEND_WALLET_PRIVATE_KEY");
}
