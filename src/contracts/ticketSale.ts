import { encodeFunctionData, keccak256, toBytes, type Hex } from "viem";

import { ticketSaleAbi } from "@/src/contracts/ticketSale.abi";

type PurchaseArgs = {
  splitId: string;
  orderId: string;
  eventId: bigint;
  uri?: string;
};

function hashId(value: string): Hex {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Değer gerekli");
  return keccak256(toBytes(trimmed));
}

export function buildPurchaseCalldata({ splitId, orderId, eventId, uri }: PurchaseArgs): Hex {
  return encodeFunctionData({
    abi: ticketSaleAbi,
    functionName: "purchase",
    args: [hashId(splitId), hashId(orderId), eventId, uri ?? ""],
  });
}
