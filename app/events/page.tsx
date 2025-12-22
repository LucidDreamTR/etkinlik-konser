import type { Metadata } from "next";
import Link from "next/link";
import { events } from "@/app/events.mock";

const ogImage = "/events/opengraph-image";

export const metadata: Metadata = {
  title: "Etkinlikler · etkinlik.eth",
  description:
    "Yaklaşan konser ve etkinlikleri keşfet. TL ile ödeme, ENS doğrulama ve Web3 altyapı ile premium deneyim.",
  alternates: {
    canonical: "/events",
  },
  openGraph: {
    type: "website",
    url: "/events",
    title: "Etkinlikler · etkinlik.eth",
    description:
      "Yaklaşan konser ve etkinlikleri keşfet. TL ile ödeme, ENS doğrulama ve Web3 altyapı ile premium deneyim.",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Etkinlikler · etkinlik.eth",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Etkinlikler · etkinlik.eth",
    description:
      "Yaklaşan konser ve etkinlikleri keşfet. TL ile ödeme, ENS doğrulama ve Web3 altyapı ile premium deneyim.",
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-[-180px] top-[120px] h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[-200px] h-[620px] w-[620px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-8 flex flex-col gap-3 sm:mb-10">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Etkinlikler
          </h1>
          <p className="max-w-2xl text-pretty text-white/60">
            Yaklaşan konser ve etkinlikleri keşfet. TL ödeme · ENS doğrulama · Web3
            altyapı.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link
              key={e.slug}
              href={`/event/${e.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex flex-col gap-3">
                <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/70">
                  <span>{e.dateLabel}</span>
                  <span className="text-white/30">•</span>
                  <span>{e.cityLabel}</span>
                </div>

                <h2 className="text-xl font-semibold tracking-tight text-white">
                  {e.title}
                </h2>

                <p className="text-sm leading-relaxed text-white/60 line-clamp-3">
                  {e.description}
                </p>

                <div className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition group-hover:bg-white/10">
                  Detaylar
                  <span className="text-white/40">↗</span>
                </div>
              </div>
            </Link>
          ))}
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
