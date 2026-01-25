import { NextResponse } from "next/server";

type JsonInit = ResponseInit & {
  headers?: HeadersInit;
};

export function jsonNoStore<T>(body: T, init?: JsonInit) {
  const headers = new Headers(init?.headers ?? undefined);
  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  return NextResponse.json(body, { ...init, headers });
}
