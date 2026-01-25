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
  route?: string;
  merchantOrderId?: string | null;
  tokenId?: string | null;
  ip?: string | null;
  reason?: string | null;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashIdentifier(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return sha256(value);
}

export function emitMetric(event: MetricEvent, tags: MetricTags, latencyMs: number) {
  const payload = {
    event,
    tags: {
      ...(tags.route ? { route: tags.route } : {}),
      ...(tags.merchantOrderId ? { merchantOrderId: hashIdentifier(tags.merchantOrderId) } : {}),
      ...(tags.tokenId ? { tokenId: tags.tokenId } : {}),
      ...(tags.ip ? { ip: hashIdentifier(tags.ip) } : {}),
      ...(tags.reason ? { reason: tags.reason } : {}),
    },
    latency_ms: latencyMs,
  };

  logger.info("metric", payload);
}
