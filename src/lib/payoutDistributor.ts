import { decodeFunctionData, encodeFunctionData, keccak256, toBytes, type Hex } from "viem";

import { payoutDistributorAbi } from "@/src/contracts/payoutDistributor.abi";

type BuildArgs = {
  splitId: string;
  orderId: string;
};

function isBytes32Hex(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function hashId(value: string): Hex {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("value required");
  if (isBytes32Hex(trimmed)) return trimmed;
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
