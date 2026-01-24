import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireDebugAccess } from "@/src/server/debugFlags";

export async function GET() {
  if (!requireDebugAccess()) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  try {
    const wrote = new Date().toISOString();
    await kv.set("kv:ping", wrote);
    const read = await kv.get<string>("kv:ping");
    return NextResponse.json({ ok: true, wrote, read, same: read === wrote });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
