import "server-only";

import { type Address } from "viem";

import { getPublicClient } from "./chain";
import { payoutAbi } from "./tx";

export async function simulateDistribute(args: {
  contract: Address;
  recipients: Address[];
  amountsWei: bigint[];
  valueWei: bigint;
}) {
  const client = getPublicClient();
  return client.simulateContract({
    address: args.contract,
    abi: payoutAbi,
    functionName: "distribute",
    args: [args.recipients, args.amountsWei],
    value: args.valueWei,
  });
}
