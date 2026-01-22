import { encodePacked, keccak256 } from "viem";

export function computeOrderId(params: {
  paymentIntentId: string;
  buyer: `0x${string}`;
  eventId: bigint;
  chainId: number;
}): `0x${string}` {
  return keccak256(
    encodePacked(
      ["string", "address", "uint256", "uint256"],
      [params.paymentIntentId, params.buyer, params.eventId, BigInt(params.chainId)]
    )
  );
}
