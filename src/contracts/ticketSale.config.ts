import { getExplorerBase, getPublicChainId, resolvePublicChain } from "../chains/chainFromEnv";

const chainId = getPublicChainId();
const ticketSaleAddress =
  (chainId === 1
    ? process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS_MAINNET
    : chainId === 11155111
      ? process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS_SEPOLIA
      : process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS_LOCAL) ?? null;

export const TICKET_SALE_CHAIN = resolvePublicChain();
export const TICKET_SALE_ADDRESS = ticketSaleAddress as `0x${string}` | null;
export const TICKET_SALE_EXPLORER_BASE = getExplorerBase(chainId);
export const TICKET_TX_ENABLED = process.env.NEXT_PUBLIC_TX_ENABLED !== "false";

export function requireTicketSaleAddress(): `0x${string}` {
  if (!TICKET_SALE_ADDRESS) throw new Error(`Missing ticket sale address for chain ${TICKET_SALE_CHAIN.name}`);
  return TICKET_SALE_ADDRESS;
}
