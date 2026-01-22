// app/events/[slug]/page.tsx

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

import Link from "next/link";
import { parseEther, type Hex } from "viem";

import { resolveRecipient } from "@/lib/address";
import { buildPayoutParams, computeAmountsWei } from "@/lib/payouts";
import { normalizeSplitSlug } from "@/lib/events";
import { normalizeSlug } from "@/lib/slug";
import { EVENTS } from "@/data/events";
import { PAYOUT_ADDRESS } from "@/src/contracts/payoutDistributor.config";
import { buildPurchaseCalldata } from "@/src/contracts/ticketSale";
import { TICKET_SALE_ADDRESS, TICKET_SALE_CHAIN, TICKET_TX_ENABLED } from "@/src/contracts/ticketSale.config";
import { TICKET_NFT_ADDRESS } from "@/src/contracts/ticketNft.config";
import PayWithMetaMask from "./PayWithMetaMask";
import MetaMaskPurchase from "../components/MetaMaskPurchase";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const normalized = normalizeSlug(slug);

  if (process.env.NODE_ENV === "development") {
    console.log("[event lookup]", {
      raw: slug,
      norm: normalized,
      count: EVENTS.length,
      slugs: EVENTS.map((e) => e.slug),
      norms: EVENTS.map((e) => normalizeSlug(e.slug)),
    });
  }

  const event = EVENTS.find((e) => normalizeSlug(e.slug) === normalized);
  if (!event) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h1 className="text-3xl font-semibold">Etkinlik bulunamadı</h1>
          <p className="mt-3 text-white/60">Aradığınız etkinlik şu anda listede yok.</p>
          <div className="mt-6">
            <Link href="/events" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/5">
              Etkinliklere dön
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const planId = event.planId.trim();
  const splitSlug = normalizeSplitSlug(planId);
  const stableOrderId = `order-${splitSlug}`;
  const eventIndex = EVENTS.findIndex((e) => normalizeSlug(e.slug) === normalized);
  const eventIdNumber = eventIndex >= 0 ? eventIndex + 1 : 1;

  const resolvedPayouts =
    event.payouts && event.payouts.length > 0
      ? await Promise.all(
          event.payouts.map(async (payout) => {
            try {
              const address = await resolveRecipient(payout.recipient);
              return { ...payout, address, error: null as string | null };
            } catch (e) {
              const message = e instanceof Error ? e.message : "Çözümleme başarısız";
              return { ...payout, address: null as string | null, error: message };
            }
          }),
        )
      : [];

  const totalBps = resolvedPayouts.reduce((sum, payout) => sum + payout.shareBps, 0);

  let contractParamsError: string | null = null;
  let contractParams: Awaited<ReturnType<typeof buildPayoutParams>> | null = null;
  let contractParamsPreview: Record<string, unknown> | null = null;
  let amountsPreview: ReturnType<typeof computeAmountsWei> | null = null;
  let amountsError: string | null = null;
  let transactionPayload: {
    to: `0x${string}`;
    value: bigint;
    data: Hex;
    splitId: string;
    orderId: string;
    chainId: number;
    ticketPriceWei: bigint;
    payoutAddress: `0x${string}` | null;
    ticketNftAddress: `0x${string}` | null;
  } | null = null;
  let transactionWarning: string | null = null;
  let txNetworkName: string | null = null;

  try {
    contractParams = await buildPayoutParams(event.payouts);
    contractParamsPreview = {
      ...contractParams,
      sharesBps: contractParams.sharesBps.map((v) => v.toString()),
      recipients: contractParams.recipients,
    };
  } catch (e) {
    contractParamsError = e instanceof Error ? e.message : "Unknown error";
  }

  const priceInput = (event.priceWei ?? event.ticketPriceWei) as unknown;
  let resolvedPriceWei: bigint | null = null;
  try {
    if (typeof priceInput === "bigint") {
      resolvedPriceWei = priceInput;
    } else if (typeof priceInput === "number") {
      resolvedPriceWei = parseEther(priceInput.toString());
    } else if (typeof priceInput === "string" && priceInput.trim().length > 0) {
      resolvedPriceWei = priceInput.includes(".") ? parseEther(priceInput) : BigInt(priceInput);
    }
  } catch (e) {
    amountsError = amountsError ?? (e instanceof Error ? e.message : "Fiyat okunamadı");
  }

  if (contractParams && resolvedPriceWei !== null) {
    try {
      amountsPreview = computeAmountsWei(contractParams, resolvedPriceWei);
    } catch (e) {
      amountsError = amountsError ?? (e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  }

  if (amountsPreview) {
    txNetworkName = TICKET_SALE_CHAIN.name;

    const payoutContract = PAYOUT_ADDRESS;
    const ticketSaleContract = TICKET_SALE_ADDRESS;
    const splitIdInput = event.splitId;
    const orderIdInput = stableOrderId;
    const eventIdInput = BigInt(eventIdNumber);

    if (!ticketSaleContract) {
      transactionWarning = "NFT bilet satın alma şu anda hazır değil.";
    } else if (event.paused) {
      transactionWarning = "Bu etkinlik şu anda duraklatıldı.";
    } else if (resolvedPriceWei === null || resolvedPriceWei <= 0n) {
      transactionWarning = "Bu etkinlik henüz ödeme için hazır değil.";
    } else {
      try {
        const data = buildPurchaseCalldata({
          splitId: splitIdInput,
          orderId: orderIdInput,
          eventId: eventIdInput,
          uri: event.baseURI ?? "",
        });

        transactionPayload = {
          to: ticketSaleContract as `0x${string}`,
          value: resolvedPriceWei,
          data: data as Hex,
          splitId: splitIdInput,
          orderId: orderIdInput,
          chainId: TICKET_SALE_CHAIN.id,
          ticketPriceWei: resolvedPriceWei,
          payoutAddress: payoutContract as `0x${string}` | null,
          ticketNftAddress: TICKET_NFT_ADDRESS,
        };

      } catch (e) {
        transactionWarning = e instanceof Error ? e.message : "İşlem verisi oluşturulamadı.";
      }
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Link href="/events" className="text-sm text-white/60 hover:text-white">
          ← Etkinlikler
        </Link>

        <h1 className="mt-6 text-4xl font-semibold">{event.title}</h1>

        <p className="mt-3 max-w-2xl text-white/60">{event.description}</p>

        <div className="mt-4 text-sm text-white/50">
          {event.date} · {event.location}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
          Bu etkinlik sayfası server-side üretilir ve cache/ISR mantığı revalidate ile yönetilir.
        </div>

        <MetaMaskPurchase
          eventId={eventIdNumber}
          splitSlug={splitSlug}
          amountWei={
            resolvedPriceWei !== null
              ? resolvedPriceWei.toString()
              : (event.priceWei ?? event.ticketPriceWei ?? "0")
          }
        />

        {resolvedPayouts.length > 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Dağıtım planı (önizleme)</h2>
              {totalBps !== 10000 ? (
                <span className="text-sm text-amber-300">
                  Uyarı: dağıtım oranlarının toplamı %100 değil
                </span>
              ) : (
                <span className="text-sm text-white/60">Dağıtım oranlarının toplamı %100</span>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-white/50">
                  <tr>
                    <th className="py-2">Rol / etiket</th>
                    <th className="py-2">Girdi (ENS)</th>
                    <th className="py-2">Çözümlenen adres</th>
                    <th className="py-2 text-right">Oran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {resolvedPayouts.map((payout) => (
                    <tr key={`${payout.role}-${payout.recipient}`} className="align-top">
                      <td className="py-3">
                        <div className="font-semibold capitalize">{payout.role}</div>
                        {payout.label ? <div className="text-white/60">{payout.label}</div> : null}
                      </td>
                      <td className="py-3 text-white/80">{payout.recipient}</td>
                      <td className="py-3">
                        {payout.address ? (
                          <span className="text-emerald-300">{payout.address}</span>
                        ) : (
                          <span className="text-amber-300">{payout.error ?? "Çözümlenemedi"}</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-white/80">
                        {(payout.shareBps / 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {contractParams && contractParamsPreview ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Kontrat parametreleri (önizleme)</h2>
              <span className="text-sm text-white/60">Toplam %{(contractParams.totalBps / 100).toFixed(2)}</span>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-black/40 p-4 text-xs text-white/80">
{JSON.stringify(contractParamsPreview, null, 2)}
            </pre>
          </div>
        ) : contractParamsError ? (
          <div className="mt-6 rounded-3xl border border-amber-400/60 bg-amber-500/10 p-4 text-sm text-amber-200">
            Kontrat parametreleri hatası: {contractParamsError}
          </div>
        ) : null}

        {amountsPreview ? (
          <>
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tutarlar (önizleme)</h2>
                <span className="text-sm text-white/60">Toplam tutar (wei): {amountsPreview.totalAmountWei.toString()}</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-white/50">
                    <tr>
                      <th className="py-2">Alıcı</th>
                      <th className="py-2 text-right">Oran</th>
                      <th className="py-2 text-right">Tutar (wei)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {amountsPreview.recipients.map((recipient, idx) => (
                      <tr key={`${recipient}-${idx}`}>
                        <td className="py-3 text-white/80">{recipient}</td>
                        <td className="py-3 text-right text-white/80">{amountsPreview.sharesBps[idx].toString()}</td>
                        <td className="py-3 text-right text-emerald-300">
                          {amountsPreview.amountsWei[idx].toString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-sm text-white/70">
                Dağıtılan: {amountsPreview.distributedWei.toString()} wei · Kalan (remainder):{" "}
                {amountsPreview.remainderWei.toString()} wei
              </div>
              <div className="text-sm text-white/70">
                Ham kalan: {amountsPreview.rawRemainderWei.toString()} wei · Eklenen paydaş:{" "}
                {amountsPreview.remainderAppliedTo}
              </div>
            </div>

            {transactionPayload ? (
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">İşlem verisi (önizleme)</h2>
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    {txNetworkName ? <span>TX ağı: {txNetworkName}</span> : null}
                    <span>Satın alma çağrısı</span>
                  </div>
                </div>
                <div className="mt-4 space-y-3 text-sm text-white/80">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">to</span>
                    <span className="font-mono text-emerald-300">{transactionPayload.to}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">tutar (wei)</span>
                    <span className="font-mono">{transactionPayload.value.toString()}</span>
                  </div>
                  <div>
                    <div className="text-white/60">data</div>
                    <pre className="mt-1 overflow-x-auto rounded-2xl bg-black/40 p-3 text-[11px] text-emerald-300">{transactionPayload.data}</pre>
                  </div>
                </div>
              </div>
            ) : transactionWarning ? (
              <div className="mt-4 rounded-3xl border border-amber-400/60 bg-amber-500/10 p-4 text-sm text-amber-200">
                {transactionWarning}
              </div>
            ) : null}

            {transactionPayload ? (
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Ödeme (MetaMask)</h2>
                  <span className="text-sm text-white/60">{TICKET_SALE_CHAIN.name} ağı</span>
                </div>
                <div className="mt-4">
                  {TICKET_TX_ENABLED && transactionPayload.ticketPriceWei > 0n && transactionPayload.to ? (
                    <PayWithMetaMask
                      to={transactionPayload.to}
                      value={transactionPayload.value}
                      data={transactionPayload.data}
                      splitId={transactionPayload.splitId}
                      orderId={transactionPayload.orderId}
                      chainId={transactionPayload.chainId}
                      ticketPriceWei={transactionPayload.ticketPriceWei}
                      payoutAddress={transactionPayload.payoutAddress}
                      ticketNftAddress={transactionPayload.ticketNftAddress}
                    />
                  ) : (
                    <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
                      Bu etkinlik henüz ödeme için hazır değil.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : event.ticketPriceWei && amountsError ? (
          <div className="mt-6 rounded-3xl border border-amber-400/60 bg-amber-500/10 p-4 text-sm text-amber-200">
            Tutar hatası: {amountsError}
          </div>
        ) : null}
      </div>
    </main>
  );
}
