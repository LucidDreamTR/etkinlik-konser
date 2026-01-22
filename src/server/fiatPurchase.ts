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

import { getTicketContractAddress } from "@/lib/site";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { requireEnv, validateServerEnv } from "@/src/server/env";

const RPC_URL = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

type PurchaseWithFiatArgs = {
  merchantOrderId: string;
  eventId: string | number | bigint;
  buyerAddress: `0x${string}`;
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
  return keccak256(toBytes(trimmed));
}

function normalizeEventId(eventId: PurchaseWithFiatArgs["eventId"]): bigint {
  if (typeof eventId === "bigint") return eventId;
  if (typeof eventId === "number") return BigInt(eventId);
  if (typeof eventId === "string") return BigInt(eventId);
  throw new Error("Could not normalize eventId");
}

/**
 * Handles the minting of an NFT ticket after a successful fiat (PayTR) payment.
 * It ensures idempotency by checking if the payment ID has already been used.
 */
export async function purchaseWithFiat({
  merchantOrderId,
  eventId,
  buyerAddress,
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
        console.warn("[fiatPurchase] BACKEND_WALLET_ADDRESS mismatch", {
          env: backendAddress,
          derived: account.address,
        });
      }
    } catch {
      console.warn("[fiatPurchase] BACKEND_WALLET_ADDRESS invalid", backendAddress);
    }
  }
  if (
    process.env.NODE_ENV !== "production" &&
    RPC_URL.includes("127.0.0.1:8545") &&
    process.env.NEXT_PUBLIC_CHAIN_ID === "11155111"
  ) {
    console.warn("[fiatPurchase] RPC_URL points to localhost while chain is Sepolia", RPC_URL);
  }
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });

  const paymentId = hashPaymentId(merchantOrderId);

  const normalizedEventId = normalizeEventId(eventId);
  
  console.log(`[fiatPurchase] Attempting to mint ticket for event ${eventId} to ${buyerAddress}`);

  let txHash: Hex;
  let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>;
  // Simulate and execute the safeMint transaction
  const { request } = await publicClient.simulateContract({
    account,
    address: nftAddress,
    abi: eventTicketAbi,
    functionName: "safeMint",
    args: [buyerAddress, uri, normalizedEventId, paymentId],
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[mint] rpc", RPC_URL, "backend", account.address, "contract", nftAddress);
  }
  txHash = await walletClient.writeContract(request);
  receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Find the tokenId from the Transfer event emitted by the ERC721 contract
  const logs = receipt.logs.filter((log) => getAddress(log.address) === nftAddress);
  const parsed = parseEventLogs({ abi: eventTicketAbi, eventName: "Transfer", logs });
  const minted = parsed.find((entry) => entry.args.from === "0x0000000000000000000000000000000000000000");

  if (!minted) {
    // This should theoretically never happen if the transaction was successful.
    throw new Error("Mint transaction successful, but Transfer event not found.");
  }

  const tokenId = minted.args.tokenId.toString();
  console.log(`[fiatPurchase] Successfully minted token ${tokenId} with tx ${txHash}`);

  return {
    txHash,
    tokenId,
    nftAddress,
  };
}
