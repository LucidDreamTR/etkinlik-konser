import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function GET() {
  const allowProdDebug = process.env.ENABLE_PROD_DEBUG === "true";
  if (process.env.NODE_ENV !== "development" && !allowProdDebug) {
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
