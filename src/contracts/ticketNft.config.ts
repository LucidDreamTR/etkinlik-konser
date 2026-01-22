import { getExplorerBase, getPublicChainId, resolvePublicChain } from "../chains/chainFromEnv";

const chainId = getPublicChainId();
const ticketNftAddress =
  (chainId === 11155111
    ? process.env.NEXT_PUBLIC_TICKET_NFT_ADDRESS_SEPOLIA ?? process.env.NEXT_PUBLIC_TICKET_NFT_ADDRESS
    : process.env.NEXT_PUBLIC_TICKET_NFT_ADDRESS ?? process.env.NEXT_PUBLIC_TICKET_NFT_ADDRESS_LOCAL) ?? null;

export const TICKET_NFT_CHAIN = resolvePublicChain();
export const TICKET_NFT_ADDRESS = ticketNftAddress as `0x${string}` | null;
export const TICKET_NFT_EXPLORER_BASE = getExplorerBase(chainId);
