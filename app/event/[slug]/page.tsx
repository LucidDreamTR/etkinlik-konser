// app/event/[slug]/page.tsx

export const dynamic = "force-dynamic";
export const dynamicParams = true; // ✅ fallback: prebuild yoksa ilk istekte ISR üret
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { events } from "@/app/events.mock";

type PageProps = {
  params: { slug: string };
};

function getEventBySlug(slug: string) {
  return events.find((e) => e.slug === slug);
}

export async function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const e = getEventBySlug(params.slug);
  if (!e) {
    return {
      title: "Etkinlik Bulunamadı · etkinlik.eth",
      robots: { index: false, follow: false },
    };
  }

  const ogImage = `/event/${e.slug}/opengraph-image`;

  return {
    title: `${e.title} · etkinlik.eth`,
    description: e.description,
    alternates: { canonical: `/event/${e.slug}` },
    openGraph: {
      type: "website",
      url: `/event/${e.slug}`,
      title: `${e.title} · etkinlik.eth`,
      description: e.description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${e.title} · etkinlik.eth` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${e.title} · etkinlik.eth`,
      description: e.description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default function EventPage({ params }: PageProps) {
  const e = getEventBySlug(params.slug);
  if (!e) return notFound();

  return (
    <main className="min-h-screen bg-black">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-220px] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-[-180px] top-[120px] h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[-200px] h-[620px] w-[620px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-8 flex flex-col gap-4 sm:mb-10">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 backdrop-blur transition hover:border-white/20 hover:bg-white/10"
            >
              <span className="text-white/40">←</span> Etkinlikler
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
              <span>{e.date}</span>
              <span className="text-white/30">•</span>
              <span>{e.location}</span>
            </div>
          </div>

          <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            {e.title}
          </h1>

          <p className="max-w-3xl text-pretty text-white/60">{e.description}</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    TL ödeme
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    ENS doğrulama
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    Web3 altyapı
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/50">Tarih</div>
                    <div className="mt-1 text-sm font-medium text-white/85">{e.date}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/50">Konum</div>
                    <div className="mt-1 text-sm font-medium text-white/85">{e.location}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Detay</div>
                  <div className="mt-2 text-sm leading-relaxed text-white/70">
                    Biletleme, giriş doğrulama ve paydaş ödemeleri akıllı kontrat dağıtımı ile kurgulanır.
                    Bu sayfa premium vitrin olarak statik/ISR servis edilir.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Bilet</div>
                  <div className="mt-1 text-sm font-medium text-white/85">Yakında</div>
                  <div className="mt-2 text-xs text-white/50">(Mock akış — sonraki adımda gerçek checkout)</div>
                </div>

                <button
                  type="button"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/15"
                >
                  Bilet Al (Yakında)
                </button>

                <div className="text-xs text-white/50">etkinlik.eth · konser.eth</div>
              </div>
            </div>
          </aside>
        </section>

        <footer className="mt-10 border-t border-white/10 pt-8 text-xs text-white/50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>etkinlik.eth · konser.eth</span>
            <span>TL ödeme · ENS doğrulama · Web3 altyapı</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
