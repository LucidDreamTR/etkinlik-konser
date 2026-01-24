import { keccak256, toBytes, type Hex } from "viem";

export function hashPaymentPreimage(preimage: string): Hex {
  return keccak256(toBytes(preimage));
}
