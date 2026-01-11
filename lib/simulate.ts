import "server-only";

import { type Address } from "viem";

import { getPublicClient } from "./chain";
import { hashId } from "@/src/lib/payoutDistributor";
import { payoutDistributorAbi } from "@/src/contracts/payoutDistributor.abi";

export async function simulateDistribute(args: { contract: Address; splitId: string; orderId: string; valueWei: bigint }) {
  const client = getPublicClient();
  return client.simulateContract({
    address: args.contract,
    abi: payoutDistributorAbi,
    functionName: "distribute",
    args: [hashId(args.splitId), hashId(args.orderId)],
    value: args.valueWei,
  });
}
