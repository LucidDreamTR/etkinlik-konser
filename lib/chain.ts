import "server-only";

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

export function getPublicClient() {
  const url = process.env.ETHEREUM_RPC_URL;
  if (!url) throw new Error("Missing ETHEREUM_RPC_URL");
  return createPublicClient({ chain: mainnet, transport: http(url) });
}
