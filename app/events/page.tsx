import type { Metadata } from "next";
import { EVENTS } from "@/lib/events";

export const metadata: Metadata = {
  title: "Etkinlikler | etkinlik.eth",
  description: "Yaklaşan konser ve etkinliklerin listesi.",
  openGraph: {
    title: "Etkinlikler",
    description: "Yaklaşan konser ve etkinliklerin listesi.",
    type: "website",
    url: "/events",
    siteName: "etkinlik.eth",
    images: [
      {
        url: "/events/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Etkinlikler",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Etkinlikler",
    description: "Yaklaşan konser ve etkinliklerin listesi.",
    images: ["/events/opengraph-image"],
  },
};

export default function EventsPage() {
  return (
    <div>
      <h1>Etkinlikler</h1>

      <ul>
       {EVENTS.map((event) => (
  <li key={event.slug}>
    <a href={`/event/${event.slug}`}>
      {event.title} — {event.cityLabel} · {event.dateLabel}
    </a>
  </li>
))}
      </ul>
    </div>
  );
}
