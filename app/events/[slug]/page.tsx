// app/events/[slug]/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 300;

import Link from "next/link";
import { notFound } from "next/navigation";
import { events } from "@/app/events.mock";

type PageProps = {
  params: { slug: string };
};

export default function EventPage({ params }: PageProps) {
  const event = events.find((e) => e.slug === params.slug);
  if (!event) return notFound();

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Link href="/events" className="text-sm text-white/60 hover:text-white">
          ← Etkinlikler
        </Link>

        <h1 className="mt-6 text-4xl font-semibold">{event.title}</h1>

        <p className="mt-3 max-w-2xl text-white/60">
          {event.description}
        </p>

        <div className="mt-4 text-sm text-white/50">
          {event.date} · {event.location}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
          Bu etkinlik sayfası ISR ile üretilir ve CDN’de cache’lenir.
        </div>
      </div>
    </main>
  );
}
