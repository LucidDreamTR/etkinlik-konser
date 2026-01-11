import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { normalizeSplitSlug } from "@/lib/events";
import { ticketSaleAbi } from "@/src/contracts/ticketSale.abi";
import { ticketNftAbi } from "@/src/contracts/ticketNft.abi";
import { requireAddressEnv, requireEnv, validateServerEnv } from "@/src/server/env";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";

type PurchaseArgs = {
  merchantOrderId: string;
  splitSlug: string;
  eventId: string | number | bigint;
  amountTry?: string;
  amountWei?: string | number | bigint;
  buyerAddress?: string | null;
  ticketSaleAddress?: string;
  uri?: string;
};

function isBytes32Hex(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function hashId(value: string): Hex {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("ID boş olamaz");
  if (isBytes32Hex(trimmed)) return trimmed;
  return keccak256(toBytes(trimmed));
}

function normalizeAmountWei(amountWei: PurchaseArgs["amountWei"]): bigint | null {
  if (amountWei === undefined || amountWei === null) return null;
  if (typeof amountWei === "bigint") return amountWei;
  if (typeof amountWei === "number") return BigInt(amountWei);
  if (typeof amountWei === "string") return BigInt(amountWei);
  return null;
}

function normalizeEventId(eventId: PurchaseArgs["eventId"]): bigint {
  if (typeof eventId === "bigint") return eventId;
  if (typeof eventId === "number") return BigInt(eventId);
  if (typeof eventId === "string") return BigInt(eventId);
  throw new Error("eventId okunamadı");
}

export async function purchaseOnchain({
  merchantOrderId,
  splitSlug,
  eventId,
  amountTry: _amountTry,
  amountWei,
  buyerAddress: _buyerAddress,
  ticketSaleAddress,
  uri,
}: PurchaseArgs): Promise<{ txHash: Hex; tokenId: string; nftAddress: `0x${string}` }> {
  validateServerEnv();
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[onchainPurchase] env",
      `TICKET_SALE_ADDRESS=${process.env.TICKET_SALE_ADDRESS ?? ""}`,
      `NEXT_PUBLIC_TICKET_SALE_ADDRESS=${process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS ?? ""}`,
      `NEXT_PUBLIC_RPC_URL=${process.env.NEXT_PUBLIC_RPC_URL ?? ""}`,
      `RPC_URL=${process.env.RPC_URL ?? ""}`
    );
  }

  const privateKeyRaw = requireEnv("RELAYER_PRIVATE_KEY");
  const privateKey = (privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`;
  const saleRaw =
    ticketSaleAddress ?? process.env.TICKET_SALE_ADDRESS ?? process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS;
  let ticketSaleAddressResolved: `0x${string}`;
  try {
    ticketSaleAddressResolved = getAddress(String(saleRaw || ""));
  } catch {
    throw new Error(`Invalid ticketSaleAddress: ${String(saleRaw)}`);
  }
  const nftAddress = requireAddressEnv("NEXT_PUBLIC_TICKET_NFT_ADDRESS");

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });
  const normalizedEventId = normalizeEventId(eventId);
  const normalizedSplit = normalizeSplitSlug(splitSlug);
  const valueWei = normalizeAmountWei(amountWei);
  if (valueWei === null) {
    throw new Error("Missing amountWei");
  }
  const isPaused = await publicClient.readContract({
    address: ticketSaleAddressResolved,
    abi: ticketSaleAbi,
    functionName: "paused",
  });
  if (isPaused) {
    throw new Error("SalesPaused");
  }
  const isUsed = await publicClient.readContract({
    address: ticketSaleAddressResolved,
    abi: ticketSaleAbi,
    functionName: "usedOrderIds",
    args: [hashId(merchantOrderId)],
  });
  if (isUsed) {
    throw new Error("OrderUsed");
  }

  const { request } = await publicClient.simulateContract({
    account,
    address: ticketSaleAddressResolved,
    abi: ticketSaleAbi,
    functionName: "purchase",
    args: [hashId(normalizedSplit), hashId(merchantOrderId), normalizedEventId, uri ?? ""],
    value: valueWei,
  });

  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const logs = receipt.logs.filter((log) => getAddress(log.address) === nftAddress);
  const parsed = parseEventLogs({ abi: ticketNftAbi, eventName: "Transfer", logs });
  const minted = parsed.find((entry) => entry.args.from === "0x0000000000000000000000000000000000000000");

  if (!minted) {
    throw new Error("Mint event not found");
  }

  return {
    txHash,
    tokenId: minted.args.tokenId.toString(),
    nftAddress,
  };
}
