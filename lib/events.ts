export type EventRecord = {
  slug: string;
  title: string;
  dateLabel: string;
  cityLabel: string;

  description: string;

  venueName: string;
  venueAddress?: string;
  doorsOpenLabel?: string;
  startTimeLabel: string;

  organizerName: string;
  organizerHandle: string;

  status: "upcoming" | "live" | "ended";
  tags: string[];

  ticket: {
    priceTryLabel: string;
    supplyLabel?: string;
    saleStatus: "soon" | "on" | "soldout";
  };

  coverImageSrc?: string;
};

export const EVENTS: EventRecord[] = [
  {
    slug: "rock-gecesi",
    title: "Rock Gecesi",
    dateLabel: "12 Nisan 2025 · Cumartesi",
    cityLabel: "İstanbul",
    description:
      "Rock Gecesi, yüksek enerjili canlı performanslarla geceyi dev bir sahne deneyimine dönüştürür. Kapasite sınırlı.",
    venueName: "Blind İstanbul",
    venueAddress: "Asmalımescit, Beyoğlu",
    doorsOpenLabel: "20:00",
    startTimeLabel: "21:00",
    organizerName: "konser.eth",
    organizerHandle: "@konser.eth",
    status: "upcoming",
    tags: ["Rock", "Live", "Beyoğlu"],
    ticket: { priceTryLabel: "₺850", supplyLabel: "120 bilet", saleStatus: "soon" },
  },
];

export function getEventBySlug(slug: string): EventRecord | undefined {
  return EVENTS.find((e) => e.slug === slug);
}
