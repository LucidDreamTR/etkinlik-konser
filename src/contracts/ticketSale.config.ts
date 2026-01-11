import { anvilLocal } from "../chains/anvilLocal";

const ticketSaleAddress =
  process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS ??
  process.env.NEXT_PUBLIC_PAYOUT_SPLITTER_ADDRESS ??
  process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS_LOCAL ??
  process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS_SEPOLIA ??
  null;

export const TICKET_SALE_CHAIN = anvilLocal;
export const TICKET_SALE_ADDRESS = ticketSaleAddress as `0x${string}` | null;
export const TICKET_SALE_EXPLORER_BASE = "";
export const TICKET_TX_ENABLED = process.env.NEXT_PUBLIC_TX_ENABLED !== "false";

export function requireTicketSaleAddress(): `0x${string}` {
  if (!TICKET_SALE_ADDRESS) throw new Error(`Missing ticket sale address for chain ${TICKET_SALE_CHAIN.name}`);
  return TICKET_SALE_ADDRESS;
}
