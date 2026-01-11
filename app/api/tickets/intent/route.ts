import { NextResponse } from "next/server";
import { getAddress, isAddress, verifyTypedData } from "viem";

import { getOrderByMerchantId, recordPaidOrder } from "@/src/lib/ordersStore";
import { purchaseOnchain } from "@/src/server/onchainPurchase";

type TicketIntent = {
  buyer: string;
  splitSlug: string;
  merchantOrderId: string;
  eventId: string | number | bigint;
  amountWei: string | number | bigint;
  deadline: string | number | bigint;
};

type IntentPayload = {
  intent?: TicketIntent;
  signature?: string;
};

const INTENT_TYPES = {
  TicketIntent: [
    { name: "buyer", type: "address" },
    { name: "splitSlug", type: "string" },
    { name: "merchantOrderId", type: "string" },
    { name: "eventId", type: "uint256" },
    { name: "amountWei", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

function normalizeBigInt(value: TicketIntent["eventId"]): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error("Invalid numeric value");
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Empty body" }, { status: 400 });
    }

    let payload: IntentPayload;
    try {
      payload = JSON.parse(raw) as IntentPayload;
    } catch (error) {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const intent = payload.intent;
    const signature = payload.signature;

    if (!intent || typeof signature !== "string" || !signature.trim()) {
      return NextResponse.json({ ok: false, error: "Missing intent or signature" }, { status: 400 });
    }

    const buyerRaw = (intent as { buyer?: unknown } | undefined)?.buyer;
    const buyer = typeof buyerRaw === "string" ? buyerRaw : "";

    let buyerChecksum: `0x${string}`;
    try {
      buyerChecksum = getAddress(buyer);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid intent.buyer", buyer: buyerRaw ?? null },
        { status: 400 }
      );
    }
    if (!intent.splitSlug || !intent.merchantOrderId) {
      return NextResponse.json({ ok: false, error: "Missing splitSlug or merchantOrderId" }, { status: 400 });
    }

    const vcRaw = process.env.TICKET_SALE_ADDRESS ?? process.env.NEXT_PUBLIC_TICKET_SALE_ADDRESS;
    let verifyingContract: `0x${string}`;
    try {
      verifyingContract = getAddress(String(vcRaw || ""));
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid verifyingContract", verifyingContract: vcRaw ?? null },
        { status: 400 }
      );
    }

    const deadline = normalizeBigInt(intent.deadline);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (deadline < now) {
      return NextResponse.json({ ok: false, error: "Intent expired" }, { status: 400 });
    }

    let verifyingContractChecksum: `0x${string}`;
    try {
      verifyingContractChecksum = getAddress(String(verifyingContract));
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid verifyingContract before verifyTypedData",
          verifyingContract: verifyingContract ?? null,
        },
        { status: 400 }
      );
    }

    const domain = {
      name: "EtkinlikKonser",
      version: "1",
      chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337),
      verifyingContract: verifyingContractChecksum,
    } as const;

    let buyerChecksumForMessage: `0x${string}`;
    try {
      buyerChecksumForMessage = getAddress(String(intent.buyer));
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid buyer before verifyTypedData", buyer: intent?.buyer ?? null },
        { status: 400 }
      );
    }

    const message = {
      buyer: buyerChecksumForMessage,
      splitSlug: intent.splitSlug,
      merchantOrderId: intent.merchantOrderId,
      eventId: normalizeBigInt(intent.eventId),
      amountWei: normalizeBigInt(intent.amountWei),
      deadline: normalizeBigInt(intent.deadline),
    } as const;

    console.log("[intent debug] domain =", domain);
    console.log("[intent debug] message =", message);
    console.log("[intent debug] signature? =", typeof signature, signature?.slice?.(0, 10));

    const debug = {
      domainVerifyingContract: (domain as unknown as { verifyingContract?: string })?.verifyingContract,
      messageBuyer: (message as unknown as { buyer?: string })?.buyer,
    };

    if (!debug.domainVerifyingContract || String(debug.domainVerifyingContract) === "undefined") {
      return NextResponse.json(
        { ok: false, error: "domain.verifyingContract is undefined", debug },
        { status: 400 }
      );
    }

    if (!debug.messageBuyer || String(debug.messageBuyer) === "undefined") {
      return NextResponse.json(
        { ok: false, error: "message.buyer is undefined", debug },
        { status: 400 }
      );
    }

    try {
      getAddress(String(debug.domainVerifyingContract));
    } catch {
      return NextResponse.json({ ok: false, error: "domain.verifyingContract invalid", debug }, { status: 400 });
    }
    try {
      getAddress(String(debug.messageBuyer));
    } catch {
      return NextResponse.json({ ok: false, error: "message.buyer invalid", debug }, { status: 400 });
    }

    const verified = await verifyTypedData({
      address: message.buyer,
      domain,
      types: INTENT_TYPES,
      primaryType: "TicketIntent",
      message,
      signature,
    });

    if (!verified) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const existing = await getOrderByMerchantId(intent.merchantOrderId);
    if (existing) {
      if (existing.txHash) {
        return NextResponse.json({ ok: true, status: "duplicate", txHash: existing.txHash });
      }
      return NextResponse.json({ ok: true, status: "duplicate" });
    }

    const onchain = await purchaseOnchain({
      merchantOrderId: intent.merchantOrderId,
      splitSlug: intent.splitSlug,
      eventId: intent.eventId,
      amountTry: intent.amountWei.toString(),
      amountWei: intent.amountWei,
      buyerAddress: buyerChecksumForMessage,
      ticketSaleAddress: verifyingContract,
    });

    await recordPaidOrder({
      merchantOrderId: intent.merchantOrderId,
      splitSlug: intent.splitSlug,
      eventId: intent.eventId.toString(),
      amountTry: intent.amountWei.toString(),
      buyerAddress: buyerChecksumForMessage,
      txHash: onchain.txHash,
      tokenId: onchain.tokenId,
      nftAddress: onchain.nftAddress,
      custodyAddress: null,
      intentSignature: signature,
      intentDeadline: deadline.toString(),
      intentAmountWei: intent.amountWei.toString(),
      claimCodeHash: null,
      claimStatus: "claimed",
      claimedTo: buyerChecksumForMessage,
      claimedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, status: "processed", txHash: onchain.txHash });
  } catch (error) {
    console.error("[/api/tickets/intent] ERROR:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
