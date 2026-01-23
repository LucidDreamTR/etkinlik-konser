import { EVENTS } from "@/data/events";

export type TicketTypeConfig = {
  ticketType: string;
  label: string;
  accent: string;
  seats?: string[];
};

export type EventTicketConfig = {
  eventSlug: string;
  ticketTypes: TicketTypeConfig[];
};

const DEFAULT_TICKET_TYPE: TicketTypeConfig = {
  ticketType: "GA",
  label: "General Admission",
  accent: "#38bdf8",
  seats: [],
};

const EVENT_TICKET_CONFIG: EventTicketConfig[] = [
  {
    eventSlug: "rock-gecesi-istanbul",
    ticketTypes: [
      {
        ticketType: "VIP",
        label: "VIP Access",
        accent: "#f97316",
        seats: ["A-12", "A-13", "A-14"],
      },
      {
        ticketType: "GA",
        label: "General Admission",
        accent: "#38bdf8",
        seats: [],
      },
    ],
  },
  {
    eventSlug: "elektronik-gece",
    ticketTypes: [
      {
        ticketType: "Backstage",
        label: "Backstage",
        accent: "#22c55e",
        seats: ["B-1", "B-2"],
      },
      {
        ticketType: "GA",
        label: "General Admission",
        accent: "#38bdf8",
        seats: [],
      },
    ],
  },
];

function resolveEventSlug(eventIdNumber: number): string | null {
  if (!Number.isFinite(eventIdNumber) || eventIdNumber < 1 || eventIdNumber > EVENTS.length) return null;
  return EVENTS[eventIdNumber - 1]?.slug ?? null;
}

export function getEventTicketConfig(eventIdNumber: number): EventTicketConfig {
  const slug = resolveEventSlug(eventIdNumber);
  if (!slug) {
    return { eventSlug: "unknown", ticketTypes: [DEFAULT_TICKET_TYPE] };
  }
  const direct = EVENT_TICKET_CONFIG.find((entry) => entry.eventSlug === slug);
  if (!direct) {
    return { eventSlug: slug, ticketTypes: [DEFAULT_TICKET_TYPE] };
  }
  if (!direct.ticketTypes.length) {
    return { eventSlug: slug, ticketTypes: [DEFAULT_TICKET_TYPE] };
  }
  return direct;
}

export function getTicketTypeConfig(eventIdNumber: number, ticketType: string | null | undefined): TicketTypeConfig {
  const config = getEventTicketConfig(eventIdNumber);
  const desired = ticketType?.trim();
  const match = desired
    ? config.ticketTypes.find((entry) => entry.ticketType.toLowerCase() === desired.toLowerCase())
    : null;
  return match ?? config.ticketTypes[0] ?? DEFAULT_TICKET_TYPE;
}

export function getDefaultTicketSelection(eventIdNumber: number): {
  ticketType: string;
  seat: string | null;
} {
  const config = getEventTicketConfig(eventIdNumber);
  const primary = config.ticketTypes[0] ?? DEFAULT_TICKET_TYPE;
  const seat = primary.seats && primary.seats.length > 0 ? primary.seats[0] : null;
  return { ticketType: primary.ticketType, seat };
}
