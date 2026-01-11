import { decodeFunctionData, encodeFunctionData, keccak256, toBytes, type Hex } from "viem";

import { payoutDistributorAbi } from "@/src/contracts/payoutDistributor.abi";

type BuildArgs = {
  splitId: string;
  orderId: string;
};

export function hashId(value: string): Hex {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("value required");
  return keccak256(toBytes(trimmed));
}

export function buildDistributeCalldata({ splitId, orderId }: BuildArgs): Hex {
  const splitHash = hashId(splitId);
  const orderHash = hashId(orderId);

  return encodeFunctionData({
    abi: payoutDistributorAbi,
    functionName: "distribute",
    args: [splitHash, orderHash],
  });
}

export function decodeDistributeCalldata(data: Hex) {
  const decoded = decodeFunctionData({
    abi: payoutDistributorAbi,
    data,
  });

  if (decoded.functionName !== "distribute") {
    throw new Error("Invalid distribute calldata");
  }

  return decoded;
}
