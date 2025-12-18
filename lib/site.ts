// lib/site.ts
export function getSiteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "http://localhost:3000";

  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getMetadataBase() {
  return new URL(getSiteUrl());
}
