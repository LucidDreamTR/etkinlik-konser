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

export function validateServerEnv(): void {
  requireEnv("RELAYER_PRIVATE_KEY");
  requireAddressEnv("TICKET_SALE_ADDRESS");
  requireAddressEnv("NEXT_PUBLIC_TICKET_NFT_ADDRESS");

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("Missing env: NEXT_PUBLIC_RPC_URL or RPC_URL");
  }
}
