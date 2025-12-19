// lib/site.ts
export function getMetadataBase(): URL {
  // 1) Manuel tanımladığın domain (tercih)
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);

  // 2) Vercel prod domain (varsa)
  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prodUrl) return new URL(`https://${prodUrl}`);

  // 3) Vercel deployment domain (her deploy’da olur)
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return new URL(`https://${vercelUrl}`);

  // 4) Lokal fallback
  return new URL("http://localhost:3000");
}
