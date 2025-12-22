// app/events/page.tsx

export const dynamic = "force-static";
export const revalidate = 300;

import Link from "next/link";
import { events } from "@/app/events.mock";

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="mb-10 text-4xl font-semibold">Etkinlikler</h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link
              key={e.slug}
              href={`/events/${e.slug}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10"
            >
              <h2 className="text-xl font-semibold">{e.title}</h2>
              <p className="mt-2 text-sm text-white/60">{e.description}</p>
              <div className="mt-4 text-xs text-white/50">
                {e.date} · {e.location}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
