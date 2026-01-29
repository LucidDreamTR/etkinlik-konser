"use client";

import * as React from "react";
import { createWalletClient, custom, getAddress } from "viem";

import { EVENTS } from "@/data/events";
import { getEventTicketConfig, getTicketTypeConfig } from "@/data/ticketMetadata";
import { getExplorerTxUrl } from "@/lib/explorer";
import { safeJsonStringify } from "@/src/lib/json";
import { LoadingShimmerText } from "@/src/components/LoadingShimmerText";

type Props = {
  to: `0x${string}` | null;
  value: bigint;
  data: `0x${string}`;
  splitId: string;
  orderId: string;
  chainId: number;
  ticketPriceWei: bigint;
  payoutAddress: `0x${string}` | null;
  ticketNftAddress: `0x${string}` | null;
};

type IntentPayload = {
  buyer: `0x${string}`;
  splitSlug: string;
  merchantOrderId: string;
  eventId: string;
  amountWei: string;
  deadline: string;
  ticketType?: string;
  seat?: string | null;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};

function normalizeJsonValue(value: string | number | bigint): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}

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

function resolveEventBySplitId(splitId: string) {
  const index = EVENTS.findIndex((event) => event.splitId === splitId);
  if (index < 0) return null;
  return { event: EVENTS[index], eventIdNumber: index + 1 };
}

export default function PayWithMetaMask(props: Props) {
  const [hasMetaMask, setHasMetaMask] = React.useState(false);
  const [account, setAccount] = React.useState<`0x${string}` | null>(null);
  const [status, setStatus] = React.useState<"idle" | "signing" | "purchasing" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);

  const resolvedEvent = React.useMemo(() => resolveEventBySplitId(props.splitId), [props.splitId]);
  const eventIdNumber = resolvedEvent?.eventIdNumber ?? 0;
  const ticketConfig = getEventTicketConfig(eventIdNumber);
  const [ticketType, setTicketType] = React.useState<string>(ticketConfig.ticketTypes[0]?.ticketType ?? "GA");
  const [seat, setSeat] = React.useState<string | null>(
    ticketConfig.ticketTypes[0]?.seats && ticketConfig.ticketTypes[0].seats.length > 0
      ? ticketConfig.ticketTypes[0].seats[0]
      : null
  );

  React.useEffect(() => {
    setHasMetaMask(
      typeof window !== "undefined" && Boolean((window as unknown as { ethereum?: unknown }).ethereum)
    );
  }, []);

  React.useEffect(() => {
    if (!resolvedEvent) return;
    const resolved = getTicketTypeConfig(eventIdNumber, ticketType);
    const nextSeat = resolved.seats && resolved.seats.length > 0 ? resolved.seats[0] : null;
    if (!resolved.seats || resolved.seats.length === 0) {
      setSeat(null);
    } else if (seat && resolved.seats.includes(seat)) {
      setSeat(seat);
    } else {
      setSeat(nextSeat);
    }
  }, [eventIdNumber, resolvedEvent, seat, ticketType]);

  const connectWallet = React.useCallback(async () => {
    setError(null);
    if (typeof window === "undefined" || !(window as unknown as { ethereum?: unknown }).ethereum) {
      setError("MetaMask bulunamadı.");
      return;
    }
    const ethereum = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (!ethereum) {
      setError("MetaMask bulunamadı.");
      return;
    }
    const client = createWalletClient({ transport: custom(ethereum) });
    const accounts = await client.requestAddresses();
    if (!accounts?.length) {
      setError("Cüzdan adresi alınamadı.");
      return;
    }
    setAccount(getAddress(accounts[0]));
  }, []);

  const purchase = React.useCallback(async () => {
    setError(null);
    setTxHash(null);
    if (!account) {
      setError("Önce cüzdanı bağlayın.");
      return;
    }
    if (!resolvedEvent) {
      setError("Etkinlik bulunamadı.");
      return;
    }
    if (!resolvedEvent.event.planId) {
      setError("splitSlug bulunamadı.");
      return;
    }
    const contractAddress = props.ticketNftAddress;
    if (!contractAddress) {
      setError("TICKET_CONTRACT / verifying contract missing.");
      return;
    }
    if (typeof window === "undefined" || !(window as unknown as { ethereum?: unknown }).ethereum) {
      setError("MetaMask bulunamadı.");
      return;
    }

    const ethereum = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (!ethereum) {
      setError("MetaMask bulunamadı.");
      return;
    }
    const client = createWalletClient({ transport: custom(ethereum) });
    const chainIdHex = await client.request({ method: "eth_chainId" });
    if (typeof chainIdHex !== "string") {
      setError("Unable to detect network.");
      return;
    }

    const connectedChainId = parseInt(chainIdHex, 16);
    if (connectedChainId !== props.chainId) {
      setError(`Yanlış ağ bağlı. MetaMask: ${connectedChainId}, Beklenen: ${props.chainId}`);
      return;
    }

    const merchantOrderId = globalThis.crypto?.randomUUID?.() ?? `order-${Date.now()}`;
    const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
    const intent: IntentPayload = {
      buyer: account,
      splitSlug: resolvedEvent.event.planId,
      merchantOrderId,
      eventId: normalizeJsonValue(eventIdNumber),
      amountWei: normalizeJsonValue(props.ticketPriceWei),
      deadline: normalizeJsonValue(deadline),
      ticketType,
      seat,
    };

    console.log("[metamask] intent payload types", {
      eventId: typeof intent.eventId,
      amountWei: typeof intent.amountWei,
      deadline: typeof intent.deadline,
    });

    setStatus("signing");
    const initRes = await fetch("/api/tickets/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: safeJsonStringify({ intent }),
    });
    const initJson = (await initRes.json()) as { ok?: boolean; error?: string };
    if (!initRes.ok || !initJson.ok) {
      setStatus("error");
      setError(initJson.error ?? "Intent oluşturulamadı.");
      return;
    }

    console.log("[metamask] requestAddresses start");
    try {
      await client.requestAddresses();
    } catch {
      await ethereum.request({ method: "eth_requestAccounts" });
    }
    console.log("[metamask] requestAddresses done");

    const signature = await client.signTypedData({
      account,
      domain: {
        name: "EtkinlikKonser",
        version: "1",
        chainId: props.chainId,
        verifyingContract: contractAddress,
      },
      types: INTENT_TYPES,
      primaryType: "TicketIntent",
      message: {
        buyer: account,
        splitSlug: intent.splitSlug,
        merchantOrderId: intent.merchantOrderId,
        eventId: BigInt(intent.eventId),
        amountWei: BigInt(intent.amountWei),
        deadline: BigInt(intent.deadline),
      },
    });

    const purchasingStartedAt = Date.now();
    setStatus("purchasing");
    let nextStatus: "success" | "error" = "error";
    let nextError: string | null = null;
    let nextTxHash: string | null = null;
    try {
      const purchaseRes = await fetch("/api/tickets/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeJsonStringify({ intent, signature }),
      });
      const purchaseJson = (await purchaseRes.json()) as { ok?: boolean; txHash?: string; error?: string };
      if (!purchaseRes.ok || !purchaseJson.ok) {
        nextError = purchaseJson.error ?? "Satın alma başarısız.";
      } else {
        nextStatus = "success";
        nextTxHash = purchaseJson.txHash ?? null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Satın alma başarısız.";
      nextError = message;
    } finally {
      const elapsed = Date.now() - purchasingStartedAt;
      const wait = Math.max(0, 600 - elapsed);
      if (wait) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      setTxHash(nextTxHash);
      setError(nextError);
      setStatus(nextStatus);
    }
  }, [account, eventIdNumber, props, resolvedEvent, seat, ticketType]);

  const isBusy = status === "signing" || status === "purchasing";
  const explorerUrl = txHash ? getExplorerTxUrl(props.chainId, txHash) : null;

  if (!resolvedEvent) {
    return (
      <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
        Etkinlik bulunamadı.
      </div>
    );
  }

  const ticketTypeConfig = getTicketTypeConfig(eventIdNumber, ticketType);

  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
      <div className="space-y-3">
        <div>
          <label className="text-xs uppercase text-white/50">Ticket Type</label>
          <select
            className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
            value={ticketType}
            onChange={(event) => setTicketType(event.target.value)}
            disabled={isBusy}
          >
            {ticketConfig.ticketTypes.map((entry) => (
              <option key={entry.ticketType} value={entry.ticketType}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        {ticketTypeConfig.seats && ticketTypeConfig.seats.length > 0 ? (
          <div>
            <label className="text-xs uppercase text-white/50">Seat</label>
            <select
              className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
              value={seat ?? ""}
              onChange={(event) => setSeat(event.target.value || null)}
              disabled={isBusy}
            >
              {ticketTypeConfig.seats.map((seatOption) => (
                <option key={seatOption} value={seatOption}>
                  {seatOption}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {!hasMetaMask ? (
          <div className="text-sm text-amber-200">MetaMask yüklü değil.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
              onClick={connectWallet}
              disabled={isBusy}
            >
              {account ? `Bağlandı: ${account.slice(0, 6)}...${account.slice(-4)}` : "Cüzdanı bağla"}
            </button>

          <button
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black/80 disabled:cursor-not-allowed disabled:bg-white/90 disabled:opacity-100 disabled:shadow-none disabled:ring-1 disabled:ring-white/15"
            onClick={purchase}
            disabled={isBusy || !account}
          >
            {status === "signing" ? (
              "Signing…"
            ) : status === "purchasing" ? (
              <LoadingShimmerText text="Purchasing…" className="font-semibold" />
            ) : (
              "Buy with MetaMask"
            )}
          </button>
          </div>
        )}

        {error ? <div className="text-sm text-rose-300">{error}</div> : null}
        {status === "success" ? (
          <div className="text-sm text-emerald-300">
            Success{txHash ? ` — ${txHash.slice(0, 10)}...` : ""} {explorerUrl ? (
              <a className="underline" href={explorerUrl} target="_blank" rel="noreferrer">
                Explorer
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
