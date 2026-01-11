import crypto from "crypto";
import { NextResponse } from "next/server";

type Payload = {
  merchant_oid?: string;
  status?: string;
  total_amount?: string | number;
};

function computePaytrHash(tokenStr: string, merchantKey: string): string {
  return crypto.createHmac("sha256", merchantKey).update(tokenStr).digest("base64");
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
  if (!merchantKey || !merchantSalt) {
    return NextResponse.json(
      { ok: false, error: "Missing PAYTR_MERCHANT_KEY or PAYTR_MERCHANT_SALT" },
      { status: 400 }
    );
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const merchantOid = typeof payload.merchant_oid === "string" ? payload.merchant_oid.trim() : "";
  const status = typeof payload.status === "string" ? payload.status.trim() : "";
  const totalAmount =
    typeof payload.total_amount === "string" || typeof payload.total_amount === "number"
      ? String(payload.total_amount)
      : "";

  if (!merchantOid || !status || !totalAmount) {
    return NextResponse.json(
      { ok: false, error: "merchant_oid, status ve total_amount zorunlu" },
      { status: 400 }
    );
  }

  const tokenStr = `${merchantOid}${merchantSalt}${status}${totalAmount}`;
  const hash = computePaytrHash(tokenStr, merchantKey);

  return NextResponse.json({ ok: true, hash });
}
