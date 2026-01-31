import { getAddress } from "viem";

export type MintMode = "direct" | "custody";

export function resolveMintRecipient(
  buyerAddress: string,
  options: { mintMode?: MintMode | null; custodyWalletAddress?: string | null }
): { recipient: `0x${string}`; mode: MintMode } {
  const mode = options.mintMode ?? "direct";

  if (mode === "custody") {
    const custody = options.custodyWalletAddress;
    if (!custody) {
      throw new Error("Missing env: CUSTODY_WALLET_ADDRESS");
    }
    return { recipient: getAddress(custody), mode };
  }

  return { recipient: getAddress(buyerAddress), mode: "direct" };
}
