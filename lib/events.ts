export type PayoutRole = "artist" | "organizer" | "venue" | "platform" | "partner";

export type PayoutSplit = {
  role: PayoutRole;
  label?: string;
  recipient: string;
  shareBps: number; // basis points: 10000 = %100
};

export type EventRecord = {
  slug: string;
  title: string;
  description: string;

  date?: string;
  location?: string;

  dateLabel?: string;
  cityLabel?: string;

  venueName?: string;
  venueAddress?: string;
  doorsOpenLabel?: string;
  startTimeLabel?: string;

  organizerName?: string;
  organizerHandle?: string;

  status?: "upcoming" | "live" | "ended";
  tags?: string[];

  ticket?: {
    priceTryLabel: string;
    supplyLabel?: string;
    saleStatus: "soon" | "on" | "soldout";
  };

  ticketPriceWei?: string;

  coverImageSrc?: string;

  payouts: PayoutSplit[];
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
    ticketPriceWei: "100000000000000000", // 0.1 ETH
    payouts: [
      { role: "artist", label: "Headliner", recipient: "konser.eth", shareBps: 7000 },
      { role: "organizer", label: "Organizasyon", recipient: "0x69B358ff6fCB231751302a3c07378410fCC8E575", shareBps: 1500 },
      { role: "venue", label: "Mekan", recipient: "0x5180db8F5c931aaE63c74266b211F580155ecac8", shareBps: 1000 },
      { role: "platform", label: "Platform", recipient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", shareBps: 500 },
    ],
  },
];

export function getEventBySlug(slug: string): EventRecord | undefined {
  return EVENTS.find((e) => e.slug === slug);
}
