// app/events/[slug]/page.tsx

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

import Link from "next/link";
import { notFound } from "next/navigation";
import { events } from "@/app/events.mock";
import { resolveRecipient } from "@/lib/address";
import { buildPayoutParams, computeAmountsWei } from "@/lib/payouts";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function normalizeSlug(raw: string) {
  // güvenli normalizasyon (trailing slash / encode / boşluk)
  return decodeURIComponent(raw).replace(/\/+$/, "").trim();
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const normalized = normalizeSlug(slug);

  const event = events.find((e) => e.slug === normalized);
  if (!event) return notFound();

  const resolvedPayouts =
    event.payouts && event.payouts.length > 0
      ? await Promise.all(
          event.payouts.map(async (payout) => {
            try {
              const address = await resolveRecipient(payout.recipient);
              return { ...payout, address, error: null as string | null };
            } catch (e) {
              const message = e instanceof Error ? e.message : "Resolve failed";
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

  try {
    contractParams = await buildPayoutParams(event.payouts);
    contractParamsPreview = {
      ...contractParams,
      sharesBps: contractParams.sharesBps.map((v) => v.toString()),
    };
  } catch (e) {
    contractParamsError = e instanceof Error ? e.message : "Unknown error";
  }

  if (contractParams && event.ticketPriceWei) {
    try {
      const totalAmountWei = BigInt(event.ticketPriceWei);
      amountsPreview = computeAmountsWei(contractParams, totalAmountWei);
    } catch (e) {
      amountsError = e instanceof Error ? e.message : "Unknown error";
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

        {resolvedPayouts.length > 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Payout Split (Preview)</h2>
              {totalBps !== 10000 ? (
                <span className="text-sm text-amber-300">
                  Uyarı: toplam %{(totalBps / 100).toFixed(2)} (100.00 değil)
                </span>
              ) : (
                <span className="text-sm text-white/60">Toplam %{(totalBps / 100).toFixed(2)}</span>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-white/50">
                  <tr>
                    <th className="py-2">Role / Label</th>
                    <th className="py-2">Input (ENS/0x)</th>
                    <th className="py-2">Resolved Address</th>
                    <th className="py-2 text-right">Share (%)</th>
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
                          <span className="text-amber-300">{payout.error ?? "not resolved"}</span>
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
              <h2 className="text-lg font-semibold">Contract Params (Preview)</h2>
              <span className="text-sm text-white/60">Toplam %{(contractParams.totalBps / 100).toFixed(2)}</span>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-black/40 p-4 text-xs text-white/80">
{JSON.stringify(contractParamsPreview, null, 2)}
            </pre>
          </div>
        ) : contractParamsError ? (
          <div className="mt-6 rounded-3xl border border-amber-400/60 bg-amber-500/10 p-4 text-sm text-amber-200">
            Contract Params error: {contractParamsError}
          </div>
        ) : null}

        {amountsPreview ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Amounts (Preview)</h2>
              <span className="text-sm text-white/60">
                Total Wei: {amountsPreview.totalAmountWei.toString()}
              </span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-white/50">
                  <tr>
                    <th className="py-2">Recipient</th>
                    <th className="py-2 text-right">Share (bps)</th>
                    <th className="py-2 text-right">Amount (wei)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {amountsPreview.recipients.map((recipient, idx) => (
                    <tr key={`${recipient}-${idx}`}>
                      <td className="py-3 text-white/80">{recipient}</td>
                      <td className="py-3 text-right text-white/80">{amountsPreview.sharesBps[idx].toString()}</td>
                      <td className="py-3 text-right text-emerald-300">{amountsPreview.amountsWei[idx].toString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-white/70">
              Dağıtılan: {amountsPreview.distributedWei.toString()} wei · Kalan (remainder):{" "}
              {amountsPreview.remainderWei.toString()} wei
            </div>
          </div>
        ) : event.ticketPriceWei && amountsError ? (
          <div className="mt-6 rounded-3xl border border-amber-400/60 bg-amber-500/10 p-4 text-sm text-amber-200">
            Amounts error: {amountsError}
          </div>
        ) : null}
      </div>
    </main>
  );
}
