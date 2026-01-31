import { getServerEnv } from "./env";
import { resolveMintRecipient, type MintMode } from "./mintModeCore";

export type { MintMode };

export function getMintRecipient(
  buyerAddress: string
): { recipient: `0x${string}`; mode: MintMode } {
  const env = getServerEnv();
  return resolveMintRecipient(buyerAddress, {
    mintMode: env.MINT_MODE ?? "direct",
    custodyWalletAddress: env.CUSTODY_WALLET_ADDRESS ?? null,
  });
}

export function resolveMintModeFromOrder(order: {
  mintMode?: MintMode | null;
  custodyAddress?: string | null;
}): MintMode {
  const env = getServerEnv();
  if (order.mintMode) return order.mintMode;
  if (order.custodyAddress) return "custody";
  return env.MINT_MODE ?? "direct";
}
