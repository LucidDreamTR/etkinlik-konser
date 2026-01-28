import crypto from "crypto";

import { logger } from "./logger";

export type MetricEvent =
  | "rate_limit_hit"
  | "lock_hit"
  | "purchase_processed"
  | "purchase_pending"
  | "purchase_duplicate"
  | "claim_ok"
  | "claim_already"
  | "gate_valid"
  | "gate_invalid";

export type MetricTags = {
  route: string;
  merchantOrderId?: string | null;
  tokenId?: string | null;
  ip?: string | null;
  reason?: string | null;
  latencyMs?: number | null;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashIdentifier(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return sha256(value);
}

export function emitMetric(event: MetricEvent, tags: MetricTags) {
  const ts = new Date().toISOString();
  const payload = {
    event,
    route: tags.route,
    ...(tags.reason ? { reason: tags.reason } : {}),
    ...(tags.merchantOrderId ? { merchantOrderId_hash: hashIdentifier(tags.merchantOrderId) } : {}),
    ...(tags.tokenId ? { tokenId: tags.tokenId } : {}),
    ...(tags.ip ? { ip_hash: hashIdentifier(tags.ip) } : {}),
    ...(typeof tags.latencyMs === "number" ? { latency_ms: tags.latencyMs } : {}),
    ts,
  };

  logger.info("metric", payload);
}
