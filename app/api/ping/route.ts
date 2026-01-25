export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    { ok: true, route: "ping" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
