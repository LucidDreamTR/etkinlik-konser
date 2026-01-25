export const runtime = "nodejs";

const BUILD_SHA = "914efff";

export async function GET() {
  return Response.json(
    { ok: true, v: BUILD_SHA },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
