import rawEvents from "@/data/events.json";
import { buildSplitId, normalizeSplitSlug, type EventRecord } from "@/lib/events";

const events = rawEvents.map((event) => ({
  ...event,
  splitId: buildSplitId(event.planId),
})) as EventRecord[];

export const EVENTS = events satisfies readonly EventRecord[];

export function getEventBySlug(slug: string) {
  return EVENTS.find((e) => e.slug === slug);
}

if (process.env.NODE_ENV === "development") {
  EVENTS.forEach((event) => {
    const normalized = normalizeSplitSlug(event.planId);
    const recalculated = buildSplitId(normalized);
    console.log("[splitId demo]", {
      slug: event.planId,
      normalized,
      splitId: event.splitId,
      matches: event.splitId === recalculated,
    });
  });
}
