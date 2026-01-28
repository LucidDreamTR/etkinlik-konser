import "server-only";

import { getAddress } from "viem";

import { getServerEnv } from "./env";

const CHAIN_META: Record<number, { name: string; explorerBase: string }> = {
  1: { name: "mainnet", explorerBase: "https://etherscan.io" },
  11155111: { name: "sepolia", explorerBase: "https://sepolia.etherscan.io" },
};

export type ChainConfig = {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerBase: string;
  ticketSaleAddress: `0x${string}` | null;
  ticketContractAddress: `0x${string}` | null;
};

function normalizeAddress(value?: string | null): `0x${string}` | null {
  if (!value) return null;
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return getAddress(normalized);
}

export function getChainConfig(): ChainConfig {
  const env = getServerEnv();
  const chainIdRaw = env.NEXT_PUBLIC_CHAIN_ID ? Number(env.NEXT_PUBLIC_CHAIN_ID) : 11155111;
  const chainId = Number.isFinite(chainIdRaw) ? chainIdRaw : 11155111;
  const rpcUrl = env.RPC_URL ?? (env.MAINNET_ENABLED ? env.NEXT_PUBLIC_RPC_URL_MAINNET : env.NEXT_PUBLIC_RPC_URL_SEPOLIA);
  if (!rpcUrl) {
    throw new Error("Missing RPC_URL or network-specific NEXT_PUBLIC_RPC_URL");
  }

  const meta = CHAIN_META[chainId] ?? { name: "unknown", explorerBase: "" };
  if (env.MAINNET_ENABLED) {
    if (chainId !== 1) {
      throw new Error("MAINNET_ENABLED=true requires chainId=1.");
    }
  } else if (chainId !== 11155111) {
    throw new Error("MAINNET_ENABLED=false requires chainId=11155111.");
  }

  return {
    chainId,
    chainName: meta.name,
    rpcUrl,
    explorerBase: meta.explorerBase,
    ticketSaleAddress: normalizeAddress(
      env.MAINNET_ENABLED ? env.NEXT_PUBLIC_TICKET_SALE_ADDRESS_MAINNET : env.NEXT_PUBLIC_TICKET_SALE_ADDRESS_SEPOLIA
    ),
    ticketContractAddress: normalizeAddress(
      env.MAINNET_ENABLED
        ? env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_MAINNET
        : env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA
    ),
  };
}
