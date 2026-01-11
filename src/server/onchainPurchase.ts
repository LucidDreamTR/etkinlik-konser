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

const eventConfigAbi = [
  {
    type: "function",
    name: "eventConfigs",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "priceWei", type: "uint256", internalType: "uint256" },
      { name: "maxSupply", type: "uint256", internalType: "uint256" },
      { name: "paused", type: "bool", internalType: "bool" },
      { name: "minted", type: "uint256", internalType: "uint256" },
      { name: "exists", type: "bool", internalType: "bool" },
    ],
  },
] as const;

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

function normalizeBuyerAddress(value: PurchaseArgs["buyerAddress"], fallback: `0x${string}`): `0x${string}` {
  if (!value) return fallback;
  if (typeof value !== "string") throw new Error("buyerAddress string olmalı");
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return getAddress(normalized);
}

async function readEventPriceWei(
  client: ReturnType<typeof createPublicClient>,
  ticketSaleAddress: `0x${string}`,
  eventId: bigint,
  chainId: number
): Promise<bigint> {
  if (process.env.NODE_ENV !== "production") {
    console.log("[onchainPurchase] eventConfig.read.before", {
      rpcUrl: RPC_URL,
      ticketSaleAddress,
      chainId,
      eventId: eventId.toString(),
    });
  }

  const raw = await client.readContract({
    address: ticketSaleAddress,
    abi: eventConfigAbi,
    functionName: "eventConfigs",
    args: [eventId],
  });

  let priceWei: unknown;
  let maxSupply: unknown;
  let paused: unknown;
  let minted: unknown;
  let exists: unknown;

  if (Array.isArray(raw)) {
    [priceWei, maxSupply, paused, minted, exists] = raw;
  } else {
    ({ priceWei, maxSupply, paused, minted, exists } = raw as {
      priceWei?: unknown;
      maxSupply?: unknown;
      paused?: unknown;
      minted?: unknown;
      exists?: unknown;
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[onchainPurchase] eventConfig.read.after", {
      raw,
      parsed: { priceWei, maxSupply, paused, minted, exists },
    });
  }

  if (exists !== true) {
    throw new Error(`MissingEventConfig eventId=${eventId.toString()} sale=${ticketSaleAddress} chainId=${chainId}`);
  }
  if (paused === true) {
    throw new Error(`EventPaused eventId=${eventId.toString()}`);
  }
  if (typeof priceWei !== "bigint") {
    throw new Error(`InvalidEventConfig priceWei=${String(priceWei)}`);
  }

  return priceWei;
}

export async function purchaseOnchain({
  merchantOrderId,
  splitSlug,
  eventId,
  amountTry: _amountTry,
  amountWei,
  buyerAddress,
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
  const custodyEnv = process.env.CUSTODY_ADDRESS;

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });
  const custody = normalizeBuyerAddress(custodyEnv, account.address);
  const buyer = normalizeBuyerAddress(buyerAddress, custody);
  const normalizedEventId = normalizeEventId(eventId);
  const normalizedSplit = normalizeSplitSlug(splitSlug);
  const chainId = await publicClient.getChainId();

  const valueWei =
    normalizeAmountWei(amountWei) ??
    (await readEventPriceWei(publicClient, ticketSaleAddressResolved, normalizedEventId, chainId));

  const { request } = await publicClient.simulateContract({
    account,
    address: ticketSaleAddressResolved,
    abi: ticketSaleAbi,
    functionName: "purchaseFor",
    args: [buyer, hashId(normalizedSplit), hashId(merchantOrderId), normalizedEventId, uri ?? ""],
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
