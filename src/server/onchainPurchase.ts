import { createPublicClient, createWalletClient, getAddress, http, parseEventLogs, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { normalizeSplitSlug } from "@/lib/events";
import { getTicketContractAddress } from "@/lib/site";
import { eventTicketAbi } from "@/src/contracts/eventTicket.abi";
import { requireEnv, validateServerEnv } from "@/src/server/env";

const RPC_URL = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

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
  validateServerEnv();
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[onchainPurchase] env",
      `NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS=${process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS ?? ""}`,
      `NEXT_PUBLIC_RPC_URL=${process.env.NEXT_PUBLIC_RPC_URL ?? ""}`,
      `RPC_URL=${process.env.RPC_URL ?? ""}`
    );
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
        console.warn("[onchainPurchase] BACKEND_WALLET_ADDRESS mismatch", {
          env: backendAddress,
          derived: backendAccount.address,
        });
      }
    } catch {
      console.warn("[onchainPurchase] BACKEND_WALLET_ADDRESS invalid", backendAddress);
    }
  }
  if (
    process.env.NODE_ENV !== "production" &&
    RPC_URL.includes("127.0.0.1:8545") &&
    process.env.NEXT_PUBLIC_CHAIN_ID === "11155111"
  ) {
    console.warn("[onchainPurchase] RPC_URL points to localhost while chain is Sepolia", RPC_URL);
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[onchainPurchase] backend", backendAccount.address, "contract", nftAddress);
  }
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: backendAccount, transport: http(RPC_URL) });
  const normalizedEventId = normalizeEventId(eventId);
  const normalizedSplit = normalizeSplitSlug(splitSlug);
  if (!isBytes32Hex(orderId)) {
    throw new Error("Invalid orderId");
  }

  const paymentId = orderId;
  const tokenUri = uri?.trim();
  if (!tokenUri) {
    throw new Error("Missing token URI");
  }

  let to: `0x${string}`;
  try {
    to = getAddress(String(_buyerAddress ?? backendAccount.address));
  } catch {
    throw new Error("Invalid buyer address");
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[onchainPurchase] mint.request", {
      eventId: normalizedEventId.toString(),
      splitSlug: normalizedSplit,
    });
  }

  const { request } = await publicClient.simulateContract({
    account: backendAccount,
    address: nftAddress,
    abi: eventTicketAbi,
    functionName: "safeMint",
    args: [to, tokenUri, normalizedEventId, paymentId],
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[mint] rpc", RPC_URL, "backend", backendAccount.address, "contract", nftAddress);
  }
  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const logs = receipt.logs.filter((log) => getAddress(log.address) === nftAddress);
  const parsed = parseEventLogs({ abi: eventTicketAbi, eventName: "Transfer", logs });
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
