export const runtime = "nodejs";

const HEALTH_VERSION = "480f052";

export async function GET() {
  return Response.json(
    { ok: true, v: HEALTH_VERSION },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
