import type { Metadata } from "next";
import { events } from "../../events.mock";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = events.find((e) => e.slug === slug);

  if (!event) {
    return {
      title: "Etkinlik bulunamadı",
      description: "Aradığınız etkinlik mevcut değil.",
    };
  }

  return {
    title: `${event.title} | etkinlik.eth`,
    description: `${event.location} · ${event.date} tarihinde gerçekleşecek etkinlik.`,
    openGraph: {
      title: event.title,
      description: `${event.location} · ${event.date}`,
      type: "website",
      url: `/event/${event.slug}`,
      siteName: "etkinlik.eth",
    },
    twitter: {
      card: "summary",
      title: event.title,
      description: `${event.location} · ${event.date}`,
    },
  };
}



export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const event = events.find((e) => e.slug === slug);

  if (!event) {
    return <h1>Etkinlik bulunamadı</h1>;
  }

  return (
    <div>
      <h1>{event.title}</h1>
      <p>Tarih: {event.date}</p>
      <p>Yer: {event.location}</p>
    </div>
  );
}
