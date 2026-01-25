export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    { ok: true, v: "f7d9db9" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
