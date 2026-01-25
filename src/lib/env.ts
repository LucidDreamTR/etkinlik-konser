import "server-only";

import { z } from "zod";

import { logger } from "./logger";

export function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Server-only module imported in a client context.");
  }
}

const boolFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value === "true";
    if (typeof value === "undefined") return defaultValue;
    return value;
  }, z.boolean());

const serverEnvSchema = z.object({
  NEXT_PUBLIC_RPC_URL: z.string().min(1),
  NEXT_PUBLIC_TICKET_SALE_ADDRESS: z.string().min(1),
  NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS: z.string().min(1),
  NEXT_PUBLIC_CHAIN_ID: z.string().optional(),
  KV_REST_API_URL: z.string().min(1),
  KV_REST_API_TOKEN: z.string().min(1),
  BACKEND_WALLET_PRIVATE_KEY: z.string().min(1),
  ENABLE_PROD_DEBUG: boolFromEnv(false),
  ALLOW_UNSIGNED_INTENT: boolFromEnv(false),
  FEATURE_TICKETING_ENABLED: boolFromEnv(true),
  GATE_OPERATOR_KEY: z.string().optional(),
  RPC_URL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;
let releaseLogged = false;

function formatZodErrors(error: z.ZodError): string {
  return error.errors.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`).join("; ");
}

export function getServerEnv(): ServerEnv {
  assertServerOnly();
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${formatZodErrors(parsed.error)}`);
  }

  cachedEnv = parsed.data;

  if (!releaseLogged) {
    releaseLogged = true;
    logger.info("release", {
      commit: cachedEnv.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      vercelEnv: cachedEnv.VERCEL_ENV ?? "unknown",
    });
  }

  return cachedEnv;
}
