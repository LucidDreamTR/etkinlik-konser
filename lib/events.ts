export type PayoutRole = "artist" | "organizer" | "venue" | "platform" | "partner";

export type PayoutSplit = {
  role: PayoutRole;
  label?: string;
  recipient: string;
  shareBps: number; // basis points: 10000 = %100
};

export type EventRecord = {
  slug: string;
  planId: string;
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
