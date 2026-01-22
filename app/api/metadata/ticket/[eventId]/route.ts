import { NextRequest, NextResponse } from "next/server";

import { EVENTS } from "@/data/events";
import { getPublicBaseUrl } from "@/lib/site";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function resolveEvent(eventIdParam: string | undefined) {
  const trimmed = eventIdParam?.trim() ?? "";
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && Number.isInteger(numeric) && numeric >= 1 && numeric <= EVENTS.length) {
    return { event: EVENTS[numeric - 1], eventIdNumber: numeric };
  }

  const direct = EVENTS.find((event) => event.slug === trimmed || event.planId === trimmed);
  if (!direct) return null;
  const index = EVENTS.findIndex((event) => event.slug === direct.slug);
  return { event: direct, eventIdNumber: index >= 0 ? index + 1 : 0 };
}

function buildSvg(eventName: string, dateLabel: string, venueLabel: string, eventId: number) {
  const title = escapeXml(eventName);
  const date = escapeXml(dateLabel);
  const venue = escapeXml(venueLabel);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="510" rx="32" fill="#0b1220" stroke="#334155" stroke-width="2"/>
  <text x="110" y="180" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="56" font-weight="700">${title}</text>
  <text x="110" y="260" fill="#94a3b8" font-family="Arial, sans-serif" font-size="32">${date}</text>
  <text x="110" y="320" fill="#94a3b8" font-family="Arial, sans-serif" font-size="28">${venue}</text>
  <text x="110" y="470" fill="#38bdf8" font-family="Arial, sans-serif" font-size="24">Ticket #${eventId}</text>
  <text x="110" y="510" fill="#64748b" font-family="Arial, sans-serif" font-size="20">Etkinlik & Konser</text>
</svg>
`.trim();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await context.params;
  const fallbackId = new URL(request.url).pathname.split("/").pop() || "";
  const resolved = resolveEvent(eventId ?? fallbackId);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "event_not_found" },
      { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  const { event, eventIdNumber } = resolved;
  const chainId = 11155111;
  const venue = event.venueName ?? event.location ?? "TBA";
  const date = event.date ?? event.dateLabel ?? "TBA";
  const svg = buildSvg(event.title, date, venue, eventIdNumber);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const baseUrl = getPublicBaseUrl();
  const externalUrl = `${baseUrl}/events/${event.slug}`;

  const body = {
    name: `Ticket #${eventIdNumber} — ${event.title}`,
    description: event.description ?? "Event ticket",
    external_url: externalUrl,
    image,
    attributes: [
      { trait_type: "EventId", value: eventIdNumber },
      { trait_type: "EventName", value: event.title },
      ...(venue ? [{ trait_type: "Venue", value: venue }] : []),
      ...(event.cityLabel ?? event.location ? [{ trait_type: "City", value: event.cityLabel ?? event.location }] : []),
      { trait_type: "ChainId", value: Number.isFinite(chainId) ? chainId : 31337 },
      { trait_type: "TicketType", value: "General Admission" },
    ],
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
