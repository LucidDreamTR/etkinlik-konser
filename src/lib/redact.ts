const REDACT_KEY_PATTERN = /(private|secret|claimcode|preimage|kv_.*token|operator_key)/i;
const HEX64_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function shouldRedactKey(key: string): boolean {
  if (key.toLowerCase() === "tokenid") return false;
  return REDACT_KEY_PATTERN.test(key);
}

function redactString(value: string): string {
  if (HEX64_PATTERN.test(value)) return "[REDACTED]";
  return value;
}

function redactValue(value: unknown, parentKey?: string): unknown {
  if (typeof value === "string") {
    if (parentKey && shouldRedactKey(parentKey)) return "[REDACTED]";
    return redactString(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }
  if (value && typeof value === "object") {
    if (value instanceof Error) {
      return { name: value.name, message: value.message };
    }
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      next[key] = shouldRedactKey(key) ? "[REDACTED]" : redactValue(entry, key);
    }
    return next;
  }
  return value;
}

export function redact<T>(value: T): T {
  return redactValue(value) as T;
}
