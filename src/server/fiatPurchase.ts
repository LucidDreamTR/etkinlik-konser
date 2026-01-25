import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseEventLogs,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getPublicBaseUrl, getTicketContractAddress } from "@/lib/site";
import { hashPaymentPreimage } from "@/src/lib/paymentHash";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { requireEnv, validateServerEnv } from "@/src/server/env";
import { logger } from "@/src/lib/logger";

const RPC_URL = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

type PurchaseWithFiatArgs = {
  merchantOrderId: string;
  eventId: string | number | bigint;
  buyerAddress: `0x${string}`;
  // QR code content (payment preimage) used to derive onchain paymentId.
  paymentPreimage: string;
  // The URI for the token metadata
  uri: string; 
};

type PurchaseResult =
  | { alreadyUsed: true }
  | { alreadyUsed?: false; txHash: Hex; tokenId: string; nftAddress: `0x${string}` };

/**
 * Converts a string ID (like merchantOrderId) into a bytes32 hex string.
 * This is crucial for interacting with the smart contract which expects a bytes32 paymentId.
 * @param value The string to hash.
 * @returns A hex string representation of the hash.
 */
function hashPaymentId(value: string): Hex {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Payment ID cannot be empty");
  // QR code content === payment preimage.
  return hashPaymentPreimage(trimmed);
}

function normalizeEventId(eventId: PurchaseWithFiatArgs["eventId"]): bigint {
  if (typeof eventId === "bigint") return eventId;
  if (typeof eventId === "number") return BigInt(eventId);
  if (typeof eventId === "string") return BigInt(eventId);
  throw new Error("Could not normalize eventId");
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

/**
 * Handles the minting of an NFT ticket after a successful fiat (PayTR) payment.
 * It ensures idempotency by checking if the payment ID has already been used.
 */
export async function purchaseWithFiat({
  merchantOrderId,
  eventId,
  buyerAddress,
  paymentPreimage,
  uri,
}: PurchaseWithFiatArgs): Promise<PurchaseResult> {
  validateServerEnv();

  // Use BACKEND_WALLET_PRIVATE_KEY as requested for the minter wallet
  const privateKeyRaw = requireEnv("BACKEND_WALLET_PRIVATE_KEY");
  const privateKey = (privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`;

  // The address of the new EventTicket contract
  const nftAddress = getTicketContractAddress({ server: true });

  const account = privateKeyToAccount(privateKey);
  const backendAddress = process.env.BACKEND_WALLET_ADDRESS;
  if (process.env.NODE_ENV !== "production" && backendAddress) {
    try {
      if (getAddress(backendAddress) !== account.address) {
        logger.warn("fiatPurchase.backend_address_mismatch", {
          env: backendAddress,
          derived: account.address,
        });
      }
    } catch {
      logger.warn("fiatPurchase.backend_address_invalid", { env: backendAddress });
    }
  }
  if (
    process.env.NODE_ENV !== "production" &&
    RPC_URL.includes("127.0.0.1:8545") &&
    process.env.NEXT_PUBLIC_CHAIN_ID === "11155111"
  ) {
    logger.warn("fiatPurchase.rpc_localhost_with_sepolia", { rpcUrl: RPC_URL });
  }
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });

  // Onchain paymentId is derived ONLY from the QR preimage.
  const paymentId = hashPaymentId(paymentPreimage);

  const normalizedEventId = normalizeEventId(eventId);
  
  logger.info("fiatPurchase.mint_attempt", { eventId: String(eventId), buyerAddress });

  const appUrl = getPublicBaseUrl();
  const nextTokenId = await resolveNextTokenId(nftAddress);
  const tokenUri = `${appUrl}/api/metadata/ticket/${normalizedEventId.toString()}?tokenId=${nextTokenId.toString()}`;

  const txHash: Hex = await walletClient.writeContract(request);
  const receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>> =
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  // Simulate and execute the safeMint transaction
  const { request } = await publicClient.simulateContract({
    account,
    address: nftAddress,
    abi: eventTicketAbi,
    functionName: "safeMint",
    args: [buyerAddress, tokenUri, normalizedEventId, paymentId],
  });

  if (process.env.NODE_ENV !== "production") {
    logger.info("fiatPurchase.mint_rpc", {
      rpcUrl: RPC_URL,
      backend: account.address,
      contract: nftAddress,
    });
  }

  // Find the tokenId from the Transfer event emitted by the ERC721 contract
  const logs = receipt.logs.filter((log) => getAddress(log.address) === nftAddress);
  const parsed = parseEventLogs({ abi: eventTicketAbi, eventName: "Transfer", logs });
  const minted = parsed.find((entry) => entry.args.from === "0x0000000000000000000000000000000000000000");

  if (!minted) {
    // This should theoretically never happen if the transaction was successful.
    throw new Error("Mint transaction successful, but Transfer event not found.");
  }

  const tokenId = minted.args.tokenId.toString();
  logger.info("fiatPurchase.mint_success", { tokenId, txHash });

  return {
    txHash,
    tokenId,
    nftAddress,
  };
}
