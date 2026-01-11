import { ImageResponse } from "next/og";
import { getEventBySlug } from "@/data/events";

export const runtime = "edge";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ slug: string }> };

export default async function OpengraphImage({ params }: Props) {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  const title = event?.title ?? "etkinlik.eth";
  const city = event?.cityLabel ?? "Türkiye";
  const date = event?.dateLabel ?? "Yakında";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          backgroundColor: "#000",
          color: "#fff",
          position: "relative",
        }}
      >
        {/* arka plan glow — zIndex kullanılmadan */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -120,
              top: -160,
              width: 620,
              height: 620,
              borderRadius: 9999,
              backgroundColor: "rgba(255,255,255,0.10)",
              filter: "blur(70px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -180,
              top: 120,
              width: 700,
              height: 700,
              borderRadius: 9999,
              backgroundColor: "rgba(255,255,255,0.07)",
              filter: "blur(80px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -220,
              bottom: -260,
              width: 760,
              height: 760,
              borderRadius: 9999,
              backgroundColor: "rgba(255,255,255,0.06)",
              filter: "blur(90px)",
            }}
          />
        </div>

        {/* üst içerik */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              fontSize: 18,
              opacity: 0.8,
            }}
          >
            <div>etkinlik.eth</div>
            <div style={{ opacity: 0.4 }}>·</div>
            <div>konser.eth</div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 66,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              fontSize: 22,
              opacity: 0.9,
            }}
          >
            <div>{city}</div>
            <div style={{ opacity: 0.35 }}>•</div>
            <div>{date}</div>
          </div>
        </div>

        {/* alt içerik */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ fontSize: 18, opacity: 0.75 }}>
            TL ödeme · ENS doğrulama · Web3 altyapı
          </div>

          <div
            style={{
              display: "flex",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 9999,
              padding: "10px 16px",
              fontSize: 16,
              opacity: 0.9,
            }}
          >
            /event/{slug}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
