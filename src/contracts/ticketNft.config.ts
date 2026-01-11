import { anvilLocal } from "../chains/anvilLocal";

const ticketNftAddress =
  process.env.NEXT_PUBLIC_TICKET_NFT_ADDRESS ??
  process.env.NEXT_PUBLIC_TICKET_NFT_ADDRESS_LOCAL ??
  process.env.NEXT_PUBLIC_TICKET_NFT_ADDRESS_SEPOLIA ??
  null;

export const TICKET_NFT_CHAIN = anvilLocal;
export const TICKET_NFT_ADDRESS = ticketNftAddress as `0x${string}` | null;
export const TICKET_NFT_EXPLORER_BASE = "";
