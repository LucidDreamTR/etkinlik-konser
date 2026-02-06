import "server-only";

import { createPublicClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getChainConfig } from "@/src/lib/chain";

const MIN_BALANCE_ETH = "0.05";
const TARGET_BALANCE_ETH = "0.15";

export async function checkRelayerGasBalance(privateKeyRaw: string): Promise<void> {
  try {
    const privateKey = (privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    const chain = getChainConfig();
    const client = createPublicClient({ transport: http(chain.rpcUrl) });
    const balanceWei = await client.getBalance({ address: account.address });
    const minWei = parseEther(MIN_BALANCE_ETH);

    if (balanceWei < minWei) {
      console.warn(
        JSON.stringify({
          kind: "GAS_LOW",
          relayer: account.address,
          balanceEth: formatEther(balanceWei),
          minEth: Number(MIN_BALANCE_ETH),
          targetEth: Number(TARGET_BALANCE_ETH),
          chainId: chain.chainId,
        })
      );
    }
  } catch {
    // Gas check should never block relayer execution.
  }
}
