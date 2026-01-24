import { keccak256, toBytes, type Hex } from "viem";

export function hashPaymentPreimage(preimage: string): Hex {
  // QR code content === payment preimage; onchain paymentId is keccak256(preimage).
  return keccak256(toBytes(preimage));
}
