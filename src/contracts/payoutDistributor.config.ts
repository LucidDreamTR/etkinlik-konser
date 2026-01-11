import { getExplorerBase, getPublicChainId, resolvePublicChain } from "../chains/chainFromEnv";

const chainId = getPublicChainId();
const payoutAddress =
  (chainId === 11155111
    ? process.env.NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_ADDRESS ??
      process.env.NEXT_PUBLIC_PAYOUT_CONTRACT_ADDRESS_SEPOLIA ??
      process.env.NEXT_PUBLIC_PAYOUT_CONTRACT_ADDRESS
    : process.env.NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_ADDRESS ??
      process.env.NEXT_PUBLIC_PAYOUT_CONTRACT_ADDRESS ??
      process.env.NEXT_PUBLIC_PAYOUT_CONTRACT_ADDRESS_LOCAL) ?? null;

export const PAYOUT_ADDRESS = payoutAddress as `0x${string}` | null;
export const PAYOUT_CHAIN = resolvePublicChain();
export const PAYOUT_EXPLORER_BASE = getExplorerBase(chainId);
export const TX_ENABLED = process.env.NEXT_PUBLIC_TX_ENABLED !== "false";

export function requirePayoutAddress(): `0x${string}` {
  if (!PAYOUT_ADDRESS) throw new Error(`Missing payout contract address for chain ${PAYOUT_CHAIN.name}`);
  return PAYOUT_ADDRESS;
}
