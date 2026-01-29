import { getAddress, parseEventLogs, type TransactionReceipt } from "viem";

import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function extractMintedTokenIdFromReceipt(args: {
  receipt: TransactionReceipt;
  eventTicketAddress: `0x${string}`;
}): string | null {
  const receiptAddress = getAddress(args.eventTicketAddress);
  const logs = args.receipt.logs.filter((log) => {
    try {
      return getAddress(log.address) === receiptAddress;
    } catch {
      return false;
    }
  });
  if (logs.length === 0) return null;
  const parsed = parseEventLogs({ abi: eventTicketAbi, eventName: "Transfer", logs });
  const minted = parsed.find((entry) => entry.args.from === ZERO_ADDRESS);
  if (!minted) return null;
  return minted.args.tokenId.toString();
}
