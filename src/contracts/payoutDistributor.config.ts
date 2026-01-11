import { anvilLocal } from "../chains/anvilLocal";

const payoutAddress =
  process.env.NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_ADDRESS ??
  process.env.NEXT_PUBLIC_PAYOUT_CONTRACT_ADDRESS ??
  process.env.NEXT_PUBLIC_PAYOUT_CONTRACT_ADDRESS_LOCAL ??
  process.env.NEXT_PUBLIC_PAYOUT_CONTRACT_ADDRESS_SEPOLIA ??
  null;

export const PAYOUT_ADDRESS = payoutAddress as `0x${string}` | null;
export const PAYOUT_CHAIN = anvilLocal;
export const PAYOUT_EXPLORER_BASE = "";
export const TX_ENABLED = process.env.NEXT_PUBLIC_TX_ENABLED !== "false";

export function requirePayoutAddress(): `0x${string}` {
  if (!PAYOUT_ADDRESS) throw new Error(`Missing payout contract address for chain ${PAYOUT_CHAIN.name}`);
  return PAYOUT_ADDRESS;
}
