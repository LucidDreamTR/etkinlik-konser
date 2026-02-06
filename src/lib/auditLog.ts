import "server-only";
import crypto from "crypto";

export type AuditEvent = {
  kind: "AUDIT";
  ts: string;
  route: string;
  reason: string;
  operatorKeyId: string;
  eventId?: string | number | null;
  tokenId?: string | number | null;
  ipHash?: string | null;
  uaHash?: string | null;
  requestId?: string | null;
};

const DEFAULT_RING_SIZE = 200;
const GLOBAL_KEY = "__ETKINLIK_AUDIT_RING__";

type RingStore = {
  events: AuditEvent[];
};

const store = ((globalThis as unknown as Record<string, RingStore | undefined>)[GLOBAL_KEY] ??= {
  events: [],
});

export function deriveOperatorKeyId(operatorKey: string): string {
  const trimmed = operatorKey.trim();
  if (!trimmed) return "unknown";
  return crypto.createHash("sha256").update(trimmed).digest("hex").slice(0, 10);
}

export function logAudit(event: Omit<AuditEvent, "ts" | "kind">): void {
  const auditEvent: AuditEvent = {
    kind: "AUDIT",
    ts: new Date().toISOString(),
    ...event,
  };

  store.events.push(auditEvent);
  if (store.events.length > DEFAULT_RING_SIZE) {
    store.events.splice(0, store.events.length - DEFAULT_RING_SIZE);
  }

  console.log(JSON.stringify(auditEvent));
}

export function getAuditEvents(limit: number = DEFAULT_RING_SIZE): AuditEvent[] {
  if (limit <= 0) return [];
  return store.events.slice(-limit);
}
