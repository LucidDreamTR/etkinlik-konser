import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400; // 24 saat

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "linear-gradient(135deg, #0B0D12 0%, #0F172A 55%, #111827 100%)",
          color: "white",
          fontSize: 40,
          letterSpacing: -0.5,
        }}
      >
        <div style={{ fontSize: 22, opacity: 0.8 }}>
          etkinlik.eth • konser.eth
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>
            Etkinlikler
          </div>
          <div
            style={{
              fontSize: 26,
              opacity: 0.85,
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            Web3 biletleme ile yaklaşan konser ve etkinlikleri keşfet.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", opacity: 0.9 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#22C55E",
            }}
          />
          <div style={{ fontSize: 22 }}>
            Canlı • Güvenli • Merkeziyetsiz
          </div>
        </div>
      </div>
    ),
    size
  );
}
