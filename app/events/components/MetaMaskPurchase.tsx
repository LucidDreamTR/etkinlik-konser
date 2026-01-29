"use client";

import * as React from "react";
import { createWalletClient, custom, getAddress } from "viem";

import { getExplorerTxUrl } from "@/lib/explorer";
import { safeJsonStringify } from "@/src/lib/json";
import { LoadingShimmerText } from "@/src/components/LoadingShimmerText";

type Props = {
  eventId: number;
  splitSlug: string;
  amountWei: string;
  ticketContractAddress: `0x${string}`;
  expectedChainId: number;
};

type IntentPayload = {
  buyer: `0x${string}`;
  splitSlug: string;
  merchantOrderId: string;
  eventId: string;
  amountWei: string;
  deadline: string;
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

export default function MetaMaskPurchase({
  eventId,
  splitSlug,
  amountWei,
  ticketContractAddress,
  expectedChainId,
}: Props) {
  const [hasMetaMask, setHasMetaMask] = React.useState(false);
  const [account, setAccount] = React.useState<`0x${string}` | null>(null);
  const [status, setStatus] = React.useState<"idle" | "signing" | "purchasing" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);

  React.useEffect(() => {
    setHasMetaMask(
      typeof window !== "undefined" && Boolean((window as unknown as { ethereum?: unknown }).ethereum)
    );
  }, []);

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
    if (!splitSlug.trim()) {
      setError("splitSlug bulunamadı.");
      return;
    }
    const contractAddress = ticketContractAddress;
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
    if (connectedChainId !== expectedChainId) {
      setError(`Yanlış ağ bağlı. MetaMask: ${connectedChainId}, Beklenen: ${expectedChainId}`);
      return;
    }

    const merchantOrderId = globalThis.crypto?.randomUUID?.() ?? `order-${Date.now()}`;
    const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
    const intent: IntentPayload = {
      buyer: account,
      splitSlug,
      merchantOrderId,
      eventId: normalizeJsonValue(eventId),
      amountWei: normalizeJsonValue(amountWei),
      deadline: normalizeJsonValue(deadline),
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
        chainId: expectedChainId,
        verifyingContract: contractAddress as `0x${string}`,
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
  }, [account, amountWei, eventId, expectedChainId, splitSlug, ticketContractAddress]);

  const isBusy = status === "signing" || status === "purchasing";
  const explorerUrl = txHash ? getExplorerTxUrl(expectedChainId, txHash) : null;

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-semibold">Buy with MetaMask</h3>
      <p className="mt-2 text-sm text-white/60">Intent → imza → zincirde mint.</p>

      {!hasMetaMask ? (
        <div className="mt-4 text-sm text-amber-200">MetaMask yüklü değil.</div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
            onClick={connectWallet}
            disabled={isBusy}
          >
            {account ? `Bağlandı: ${account.slice(0, 6)}...${account.slice(-4)}` : "Cüzdanı bağla"}
          </button>

          <button
            className="rounded-full border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white/60 disabled:cursor-not-allowed disabled:opacity-80"
            onClick={purchase}
            disabled={isBusy || !account}
          >
            {status === "signing" ? (
              "Signing…"
            ) : status === "purchasing" ? (
              <LoadingShimmerText text="Purchasing…" className="font-semibold text-white/60" />
            ) : (
              "Buy with MetaMask"
            )}
          </button>
        </div>
      )}

      {error ? <div className="mt-3 text-sm text-rose-300">{error}</div> : null}
      {status === "success" ? (
        <div className="mt-3 text-sm text-emerald-300">
          Success{txHash ? ` — ${txHash.slice(0, 10)}...` : ""}{" "}
          {explorerUrl ? (
            <a className="underline" href={explorerUrl} target="_blank" rel="noreferrer">
              Explorer
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
