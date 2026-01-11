import { verifyAndParsePaytr, type ProviderVerifyResult } from "@/src/server/payments/providers/paytr";

type VerifyArgs = {
  headers: Headers;
  rawBody: string;
};

export type { ProviderVerifyResult };

export function verifyAndParse({ headers, rawBody }: VerifyArgs): ProviderVerifyResult {
  return verifyAndParsePaytr({ rawBody, env: process.env });
}
