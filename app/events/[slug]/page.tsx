// app/events/[slug]/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 300;

import Link from "next/link";
import { notFound } from "next/navigation";

type Event = {
  slug: string;
  title: string;
  description: string;
  date: string;
  location: string;
};

// 🔒 Güvenli mock getter (ileride API/DB olacak)
async function getEvent(slug: string): Promise<Event | null> {
  const events: Event[] = [
    {
      slug: "rock-gecesi",
      title: "Rock Gecesi",
      description:
        "Gecenin headliner’ları ve sürpriz konuklarla premium rock deneyimi.",
      date: "12 Nisan 2025",
      location: "İstanbul",
    },
    {
      slug: "elektronik-gece",
      title: "Elektronik Gece",
      description:
        "Analog synth’ler, deep bass ve görsel şovla elektronik gece.",
      date: "3 Mayıs 2025",
      location: "Ankara",
    },
  ];

  return events.find((e) => e.slug === slug) ?? null;
}

export default async function EventPage({
  params,
}: {
  params: { slug: string };
}) {
  const event = await getEvent(params.slug);
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
