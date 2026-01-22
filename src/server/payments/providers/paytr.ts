import crypto from "crypto";

type VerifyArgs = {
  rawBody: string;
  env: NodeJS.ProcessEnv;
};

export type ProviderVerifyResult =
  | {
      ok: true;
      merchantOrderId: string;
      status: string;
      amountTry: string;
      totalAmount: string;
      paymentAmount?: string;
      merchantId?: string;
      buyerAddress?: string | null;
      raw: Record<string, string>;
    }
  | { ok: false; reason: string };

function parseRawBody(rawBody: string): Record<string, string> | null {
  const trimmed = rawBody.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const raw: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value === undefined || value === null) continue;
        raw[key] = typeof value === "string" ? value : String(value);
      }
      return raw;
    } catch {
      return null;
    }
  }

  const params = new URLSearchParams(trimmed);
  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    raw[key] = value;
  }
  return raw;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function computePaytrHash(tokenStr: string, merchantKey: string): string {
  return crypto.createHmac("sha256", merchantKey).update(tokenStr).digest("base64");
}

function resolvePaytrEnv(env: NodeJS.ProcessEnv): {
  merchantKey: string | undefined;
  merchantSalt: string | undefined;
  merchantId: string | undefined;
} {
  const mode = (env.PAYTR_ENV ?? "test").toLowerCase();
  const suffix = mode === "prod" ? "PROD" : "TEST";
  const merchantKey = env[`PAYTR_MERCHANT_KEY_${suffix}`] ?? env.PAYTR_MERCHANT_KEY;
  const merchantSalt = env[`PAYTR_MERCHANT_SALT_${suffix}`] ?? env.PAYTR_MERCHANT_SALT;
  const merchantId = env[`PAYTR_MERCHANT_ID_${suffix}`] ?? env.PAYTR_MERCHANT_ID;
  return { merchantKey, merchantSalt, merchantId };
}

export function verifyAndParsePaytr({ rawBody, env }: VerifyArgs): ProviderVerifyResult {
  const raw = parseRawBody(rawBody);
  if (!raw) return { ok: false, reason: "Invalid body" };

  const { merchantKey, merchantSalt, merchantId } = resolvePaytrEnv(env);
  if (!merchantKey || !merchantSalt) {
    return { ok: false, reason: "Missing PayTR env" };
  }

  const merchantOrderId = raw.merchant_oid || "";
  if (!merchantOrderId) return { ok: false, reason: "Missing merchantOrderId" };

  const rawStatus = raw.status;
  if (!rawStatus) return { ok: false, reason: "Missing status" };
  const totalAmount = raw.total_amount || "";
  if (!totalAmount) return { ok: false, reason: "Missing total_amount" };
  const hash = raw.hash || "";
  if (!hash) return { ok: false, reason: "Missing hash" };

  const tokenStr = `${merchantOrderId}${merchantSalt}${rawStatus}${totalAmount}`;
  const expectedHash = computePaytrHash(tokenStr, merchantKey);
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  const hashBuffer = Buffer.from(hash, "utf8");
  if (expectedBuffer.length !== hashBuffer.length || !safeEqual(expectedBuffer, hashBuffer)) {
    return { ok: false, reason: "Invalid signature" };
  }

  const status = rawStatus.toLowerCase();
  const amountTry = raw.total_amount;
  const paymentAmount = raw.payment_amount || undefined;
  const payloadMerchantId = raw.merchant_id || undefined;
  if (payloadMerchantId && merchantId && payloadMerchantId !== merchantId) {
    return { ok: false, reason: "Invalid merchant_id" };
  }
  const buyerAddress = raw.buyerAddress || raw.buyer_address || null;

  return {
    ok: true,
    merchantOrderId,
    status,
    amountTry,
    totalAmount,
    paymentAmount,
    merchantId,
    buyerAddress,
    raw,
  };
}
