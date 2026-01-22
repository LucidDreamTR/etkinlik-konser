import "dotenv/config";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, getAddress, http, isAddress, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const events = JSON.parse(
  await readFile(new URL("../data/events.json", import.meta.url), "utf-8")
);
const payoutDistributorArtifact = JSON.parse(
  await readFile(new URL("../contracts/out/PayoutDistributor.sol/PayoutDistributor.json", import.meta.url), "utf-8")
);
const ticketSaleArtifact = JSON.parse(
  await readFile(new URL("../contracts/out/TicketSale.sol/TicketSale.json", import.meta.url), "utf-8")
);

dotenv.config({ path: ".env.local" });

const payoutDistributorAbi = payoutDistributorArtifact.abi;
const ticketSaleAbi = ticketSaleArtifact.abi;

function normalizeSplitSlug(value) {
  return decodeURIComponent(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .normalize("NFC");
}

function getRpcUrl() {
  return process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";
}

function getRelayerAccount() {
  const privateKeyRaw = process.env.RELAYER_PRIVATE_KEY;
  if (!privateKeyRaw) {
    throw new Error("Missing RELAYER_PRIVATE_KEY");
  }
  const privateKey = privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`;
  return privateKeyToAccount(privateKey);
}

function getTicketSaleAddress() {
  const saleRaw = process.env.TICKET_SALE_ADDRESS ?? process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS;
  if (!saleRaw) throw new Error("Missing TICKET_SALE_ADDRESS or NEXT_PUBLIC_TICKET_SALE_ADDRESS");
  return getAddress(saleRaw);
}

function normalizeRecipient(recipient, fallbackAddress) {
  if (isAddress(recipient)) return getAddress(recipient);
  console.warn(`[init:splits] WARN: ENS address mapped to fallback=${fallbackAddress}: ${recipient}`);
  return fallbackAddress;
}

async function main() {
  const rpcUrl = getRpcUrl();
  const account = getRelayerAccount();
  const ticketSaleAddress = getTicketSaleAddress();

  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });

  const distributorAddress = await publicClient.readContract({
    address: ticketSaleAddress,
    abi: ticketSaleAbi,
    functionName: "distributor",
  });

  const distributor = getAddress(distributorAddress);
  const fallbackAddress = account.address;

  for (const event of events) {
    const splitSlug = normalizeSplitSlug(event.planId ?? event.slug ?? "");
    if (!splitSlug) {
      throw new Error("Missing planId/slug for event");
    }
    const splitId = keccak256(toBytes(splitSlug));

    const recipients = event.payouts.map((payout) => {
      const bps = Number(payout.shareBps);
      if (!Number.isFinite(bps) || bps <= 0 || bps > 10000) {
        throw new Error(`Invalid bps for splitSlug=${splitSlug}: ${String(payout.shareBps)}`);
      }
      return {
        account: normalizeRecipient(payout.recipient, fallbackAddress),
        bps,
      };
    });

    const totalBps = recipients.reduce((sum, r) => sum + r.bps, 0);
    if (totalBps !== 10000) {
      throw new Error(`Invalid totalBps for splitSlug=${splitSlug}: ${totalBps}`);
    }

    const existing = await publicClient.readContract({
      address: distributor,
      abi: payoutDistributorAbi,
      functionName: "getSplit",
      args: [splitId],
    });

    const exists = Array.isArray(existing) && existing.length > 0;
    console.log(`Checking splitSlug=${splitSlug}, splitId=${splitId}, exists=${exists}`);

    if (exists) continue;

    const { request } = await publicClient.simulateContract({
      account,
      address: distributor,
      abi: payoutDistributorAbi,
      functionName: "setSplit",
      args: [splitId, recipients],
    });

    const txHash = await walletClient.writeContract(request);
    console.log(`Setting split ${splitSlug} tx=${txHash}`);
  }

  console.log("Done. Now /api/debug/split should show exists:true.");
}

main().catch((error) => {
  console.error("[init:splits] ERROR:", error);
  process.exit(1);
});
