import { encodeFunctionData, keccak256, toBytes, type Hex } from "viem";

import { ticketSaleAbi } from "@/src/contracts/ticketSale.abi";

type PurchaseArgs = {
  splitId: string;
  orderId: string;
  eventId: bigint;
  uri?: string;
};

function isBytes32Hex(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function hashId(value: string): Hex {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Değer gerekli");
  if (isBytes32Hex(trimmed)) return trimmed;
  return keccak256(toBytes(trimmed));
}

export function buildPurchaseCalldata({ splitId, orderId, eventId, uri }: PurchaseArgs): Hex {
  return encodeFunctionData({
    abi: ticketSaleAbi,
    functionName: "purchase",
    args: [hashId(splitId), hashId(orderId), eventId, uri ?? ""],
  });
}
