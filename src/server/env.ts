import { getAddress } from "viem";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
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
  requireAnyAddressEnv(["TICKET_CONTRACT_ADDRESS", "NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS"]);
  requireEnv("BACKEND_WALLET_PRIVATE_KEY");
}
