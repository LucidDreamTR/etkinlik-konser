import "server-only";

import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";

function getTxChainConfig() {
  const chainEnv = process.env.ETHEREUM_TX_CHAIN?.toLowerCase();
  const chain = chainEnv === "sepolia" ? sepolia : mainnet;
  const rpcUrl = process.env.ETHEREUM_TX_RPC_URL ?? process.env.ETHEREUM_RPC_URL;

  if (!rpcUrl) throw new Error("Missing ETHEREUM_TX_RPC_URL (fallback to ETHEREUM_RPC_URL)");

  return {
    chain,
    rpcUrl,
    chainName: chainEnv === "sepolia" ? "sepolia" : "mainnet",
  };
}

export function getTxChainName() {
  const { chainName } = getTxChainConfig();
  return chainName;
}

export function getPublicClient() {
  const { chain, rpcUrl } = getTxChainConfig();
  return createPublicClient({ chain, transport: http(rpcUrl) });
}
