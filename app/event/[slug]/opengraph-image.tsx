import { ImageResponse } from "next/og";
import { events } from "../../events.mock";

export const runtime = "edge";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = events.find((e) => e.slug === slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#0a0a0a",
          color: "white",
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 700 }}>
          {event ? event.title : "etkinlik.eth"}
        </div>
        <div style={{ fontSize: 32, marginTop: 24 }}>
          {event ? `${event.location} · ${event.date}` : ""}
        </div>
      </div>
    ),
    size
  );
}
