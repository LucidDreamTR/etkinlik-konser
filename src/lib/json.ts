type JsonSafe =
  | string
  | number
  | boolean
  | null
  | JsonSafe[]
  | { [key: string]: JsonSafe };

export function toJsonSafe(value: unknown): JsonSafe {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => toJsonSafe(entry));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, JsonSafe> = {};
    for (const [key, entry] of Object.entries(record)) {
      next[key] = toJsonSafe(entry);
    }
    return next;
  }
  return value as JsonSafe;
}

export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(toJsonSafe(value));
}
