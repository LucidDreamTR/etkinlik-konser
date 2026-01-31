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
