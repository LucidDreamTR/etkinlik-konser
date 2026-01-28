import { mainnet, sepolia } from "viem/chains";

import { anvilLocal } from "./anvilLocal";

export function getPublicChainId(): number {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  return 11155111;
}

export function resolvePublicChain() {
  const chainId = getPublicChainId();
  if (chainId === 11155111) return sepolia;
  if (chainId === 1) return mainnet;
  if (chainId === 31337) return anvilLocal;
  return anvilLocal;
}

export function getExplorerBase(chainId: number): string {
  if (chainId === 11155111) return "https://sepolia.etherscan.io";
  if (chainId === 1) return "https://etherscan.io";
  return "";
}
