import { createPublicClient, createWalletClient, getAddress, http, parseEventLogs, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { normalizeSplitSlug } from "@/lib/events";
import { getPublicBaseUrl, getTicketContractAddress } from "@/lib/site";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { requireEnv, validateServerEnv } from "@/src/server/env";
import { logger } from "@/src/lib/logger";
import { getChainConfig } from "@/src/lib/chain";

const RPC_URL = getChainConfig().rpcUrl;

type PurchaseArgs = {
  orderId: `0x${string}`;
  splitSlug: string;
  eventId: string | number | bigint;
  amountTry?: string;
  amountWei?: string | number | bigint;
  buyerAddress?: string | null;
  uri?: string;
};

function isBytes32Hex(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function normalizeEventId(eventId: PurchaseArgs["eventId"]): bigint {
  if (typeof eventId === "bigint") return eventId;
  if (typeof eventId === "number") return BigInt(eventId);
  if (typeof eventId === "string") return BigInt(eventId);
  throw new Error("eventId okunamadı");
}

async function resolveNextTokenId(nftAddress: `0x${string}`): Promise<bigint> {
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  return (await publicClient.readContract({
    address: nftAddress,
    abi: eventTicketAbi,
    functionName: "nextTokenId",
    args: [],
  })) as bigint;
}

export async function purchaseOnchain({
  orderId,
  splitSlug,
  eventId,
  buyerAddress: _buyerAddress,
  uri,
}: PurchaseArgs): Promise<
  | { alreadyUsed: true }
  | { alreadyUsed?: false; txHash: Hex; tokenId: string; nftAddress: `0x${string}` }
> {
  const toOnchainError = (stage: "simulate" | "send" | "receipt", error: unknown) => {
    const message = error instanceof Error ? error.message : "Onchain error";
    const err = new Error(message) as Error & { stage?: string; rpcErrorCode?: unknown };
    err.stage = stage;
    err.rpcErrorCode = (error as { code?: unknown } | null)?.code ?? null;
    return err;
  };

  validateServerEnv();
  if (process.env.NODE_ENV !== "production") {
    logger.info("onchain.env", {
      NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_MAINNET: process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_MAINNET ?? "",
      NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA: process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS_SEPOLIA ?? "",
      NEXT_PUBLIC_RPC_URL_MAINNET: process.env.NEXT_PUBLIC_RPC_URL_MAINNET ?? "",
      NEXT_PUBLIC_RPC_URL_SEPOLIA: process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA ?? "",
      RPC_URL: process.env.RPC_URL ?? "",
    });
  }

  const privateKeyRaw = requireEnv("BACKEND_WALLET_PRIVATE_KEY");
  const privateKey = (privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`;
  const backendAccount = privateKeyToAccount(privateKey);
  let nftAddress: `0x${string}`;
  try {
    nftAddress = getTicketContractAddress({ server: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid eventTicketAddress";
    throw new Error(message);
  }

  const backendAddress = process.env.BACKEND_WALLET_ADDRESS;
  if (process.env.NODE_ENV !== "production" && backendAddress) {
    try {
      if (getAddress(backendAddress) !== backendAccount.address) {
        logger.warn("onchain.backend_address_mismatch", {
          env: backendAddress,
          derived: backendAccount.address,
        });
      }
    } catch {
      logger.warn("onchain.backend_address_invalid", { env: backendAddress });
    }
  }
  if (
    process.env.NODE_ENV !== "production" &&
    RPC_URL.includes("127.0.0.1:8545") &&
    process.env.NEXT_PUBLIC_CHAIN_ID === "11155111"
  ) {
    logger.warn("onchain.rpc_localhost_with_sepolia", { rpcUrl: RPC_URL });
  }
  if (process.env.NODE_ENV !== "production") {
    logger.info("onchain.backend", { backend: backendAccount.address, contract: nftAddress });
  }
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: backendAccount, transport: http(RPC_URL) });
  const normalizedEventId = normalizeEventId(eventId);
  const normalizedSplit = normalizeSplitSlug(splitSlug);
  if (!isBytes32Hex(orderId)) {
    throw new Error("Invalid orderId");
  }

  const paymentId = orderId;
  const appUrl = getPublicBaseUrl();
  const nextTokenId = await resolveNextTokenId(nftAddress);
  const tokenUri = `${appUrl}/api/metadata/ticket/${normalizedEventId.toString()}?tokenId=${nextTokenId.toString()}`;

  let to: `0x${string}`;
  try {
    to = getAddress(String(_buyerAddress ?? backendAccount.address));
  } catch {
    throw new Error("Invalid buyer address");
  }

  if (process.env.NODE_ENV !== "production") {
    logger.info("onchain.mint_request", {
      eventId: normalizedEventId.toString(),
      splitSlug: normalizedSplit,
    });
  }

  let request;
  try {
    ({ request } = await publicClient.simulateContract({
      account: backendAccount,
      address: nftAddress,
      abi: eventTicketAbi,
      functionName: "safeMint",
      args: [to, tokenUri, normalizedEventId, paymentId],
    }));
  } catch (error) {
    throw toOnchainError("simulate", error);
  }

  if (process.env.NODE_ENV !== "production") {
    logger.info("onchain.mint_rpc", {
      rpcUrl: RPC_URL,
      backend: backendAccount.address,
      contract: nftAddress,
    });
  }
  let txHash: Hex;
  try {
    txHash = await walletClient.writeContract(request);
  } catch (error) {
    throw toOnchainError("send", error);
  }

  let receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  } catch (error) {
    throw toOnchainError("receipt", error);
  }
  const logs = receipt.logs.filter((log) => getAddress(log.address) === nftAddress);
  const parsed = parseEventLogs({ abi: eventTicketAbi, eventName: "Transfer", logs });
  const minted = parsed.find((entry) => entry.args.from === "0x0000000000000000000000000000000000000000");

  if (!minted) {
    throw toOnchainError("receipt", new Error("Mint event not found"));
  }

  return {
    txHash,
    tokenId: minted.args.tokenId.toString(),
    nftAddress,
  };
}
