import { NextResponse } from "next/server";

import { getAuditEvents } from "@/src/lib/auditLog";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function isAuditEnabled() {
  return process.env.AUDIT_DEBUG_ENABLED === "true";
}

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

export async function GET(request: Request) {
  if (!isAuditEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));
  const events = getAuditEvents(limit);

  return NextResponse.json(
    { ok: true, limit, events },
    { headers: { "Cache-Control": "no-store" } }
  );
}
