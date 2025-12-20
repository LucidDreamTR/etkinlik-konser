"use client";
// components/EventHero.tsx
import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";

type EventHeroProps = {
  title: string;
  dateLabel: string; // örn: "12 Nisan 2025 · Cumartesi"
  cityLabel: string; // örn: "İstanbul"
  coverImageSrc?: string; // örn: "/events/rock-gecesi.jpg" (opsiyonel)
  ctaLabel?: string; // örn: "Bilet Al"
  ctaHref?: string; // örn: "/checkout/rock-gecesi"
};

export default function EventHero({
  title,
  dateLabel,
  cityLabel,
  coverImageSrc,
  ctaLabel = "Yakında",
  ctaHref,
}: EventHeroProps) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 will-change-transform transition-all duration-700 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl hover:shadow-black/40">
            <div className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
        
        <Link
  href="/events"
  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 backdrop-blur transition hover:bg-white/10"
>
  <span className="text-white/60">←</span>
  Etkinlikler
</Link>

        <button
          type="button"
          onClick={async () => {
            const url = window.location.href;

            try {
              if (navigator.share) {
                await navigator.share({
                  title: document.title,
                  url,
                });
                return;
              }
            } catch {
              // kullanıcı iptal edebilir, sorun değil
            }

            try {
              await navigator.clipboard.writeText(url);
              setToast("Link kopyalandı");
            } catch {
              prompt("Linki kopyala:", url);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 backdrop-blur transition hover:bg-white/10"
        >
          Paylaş
          <span className="text-white/60">↗</span>
        </button>
      </div>
      {toast ? (
  <div className="pointer-events-none absolute right-6 top-16 z-20 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-xs text-white/80 backdrop-blur sm:right-10">
    {toast}
  </div>
) : null}
      {/* Background */}
      <div className="absolute inset-0">
        {coverImageSrc ? (
          <Image
            src={coverImageSrc}
            alt=""
            fill
            priority
            className="object-cover opacity-60"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-white/10 via-black/30 to-black" />
        )}

        {/* Premium overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-black/80" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative px-6 pb-14 pt-8 sm:px-10 sm:pb-16 sm:pt-10">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
            <span>{dateLabel}</span>
            <span className="text-white/30">•</span>
            <span>{cityLabel}</span>
          </div>

          <h1 className="text-balance bg-gradient-to-b from-white via-white/90 to-white/60 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
  {title}
</h1>

          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg line-clamp-3">
  Yüksek enerjili canlı performanslar, sınırlı kapasite ve premium sahne
  deneyimi. Web3 doğrulama altyapısıyla desteklenen özel bir gece.
</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {ctaHref ? (
              <a
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-medium text-black transition hover:-translate-y-0.5 hover:bg-white/90 active:translate-y-0"
              >
                {ctaLabel}
              </a>
            ) : (
              <button
                type="button"
                className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white/70 backdrop-blur"
                aria-disabled="true"
              >
                {ctaLabel}
              </button>
            )}

            <div className="text-sm text-white/50">
              ENS doğrulaması ve TL ödeme akışı sonraki adımlarda.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
