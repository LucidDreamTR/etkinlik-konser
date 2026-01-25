import type { NextApiRequest, NextApiResponse } from "next";

const HEALTH_VERSION = "480f052";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, v: HEALTH_VERSION });
}
