import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EventHero from "@/components/EventHero";
import EventInfo from "@/components/EventInfo";
import EventMeta from "@/components/EventMeta";
import { getEventBySlug } from "@/lib/events";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).trim();

  const event = getEventBySlug(normalizedSlug);

  if (!event) {
    return {
      title: "Etkinlik bulunamadı · etkinlik.eth",
      description: "Aradığınız etkinlik bulunamadı.",
      robots: { index: false, follow: false },
    };
  }

  const title = `${event.title} · etkinlik.eth`;
  const description = `${event.title} — ${event.cityLabel}. TL ile ödeme, ENS doğrulama ve Web3 altyapı.`;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = `${baseUrl}/event/${event.slug}`;
  const ogImage = `${baseUrl}/event/${event.slug}/opengraph-image`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: event.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).trim();

  const event = getEventBySlug(normalizedSlug);
  if (!event) return notFound();

  return (
    <main className="min-h-screen bg-black">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-[-180px] top-[120px] h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[-200px] h-[620px] w-[620px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="divide-y divide-white/10 rounded-3xl">
          <div className="py-10 lg:py-12">
            <EventHero
              title={event.title}
              dateLabel={event.dateLabel}
              cityLabel={event.cityLabel}
              ctaLabel="Yakında"
              coverImageSrc={event.coverImageSrc}
            />
          </div>

          <div className="py-10 lg:py-12">
            <EventInfo
              description={event.description}
              venueName={event.venueName}
              venueAddress={event.venueAddress}
              doorsOpenLabel={event.doorsOpenLabel}
              startTimeLabel={event.startTimeLabel}
            />
          </div>

          <div className="py-10 lg:py-12">
            <EventMeta
              organizerName={event.organizerName}
              organizerHandle={event.organizerHandle}
              status={event.status}
              tags={event.tags}
            />
          </div>
        </div>

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
