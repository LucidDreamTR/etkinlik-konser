import { ethers } from "hardhat";

function getEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function toBigInt(value: string, name: string): bigint {
  try {
    return BigInt(value);
  } catch (error) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

async function main() {
  const buyerEnv = process.env.BUYER?.trim();
  const buyer = buyerEnv ? await ethers.getSigner(buyerEnv) : (await ethers.getSigners())[0];

  // intent values (purchase endpoint ile aynı olmalı)
  const intent = {
    buyer: buyer.address,
    splitSlug: getEnv("SPLIT_SLUG", "test-split"),
    merchantOrderId: getEnv("MERCHANT_ORDER_ID", "test-order-001"),
    eventId: toBigInt(getEnv("EVENT_ID", "1"), "EVENT_ID"),
    amountWei: toBigInt(getEnv("AMOUNT_WEI", "1"), "AMOUNT_WEI"),
    deadline: toBigInt(getEnv("DEADLINE", "9999999999"), "DEADLINE"),
  };

  const domain = {
    name: "EtkinlikKonser",
    version: "1",
    chainId: Number(getEnv("CHAIN_ID", "11155111")),
    verifyingContract: getEnv("VERIFYING_CONTRACT", "0x94b0a77e901F3C0DCB3c4424C06A8bA4180bdD57"),
  };

  const types = {
    TicketIntent: [
      { name: "buyer", type: "address" },
      { name: "splitSlug", type: "string" },
      { name: "merchantOrderId", type: "string" },
      { name: "eventId", type: "uint256" },
      { name: "amountWei", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const signature = await buyer.signTypedData(domain as any, types as any, intent as any);

  console.log("buyer:", buyer.address);
  console.log("intent:", {
    buyer: intent.buyer,
    splitSlug: intent.splitSlug,
    merchantOrderId: intent.merchantOrderId,
    eventId: intent.eventId.toString(),
    amountWei: intent.amountWei.toString(),
    deadline: intent.deadline.toString(),
    chainId: domain.chainId,
    verifyingContract: domain.verifyingContract,
  });
  console.log("signature:", signature);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
