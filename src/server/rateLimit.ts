type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

// TODO: Replace in-memory limiter with Redis or a shared store for production.
export function createRateLimiter({ max, windowMs }: RateLimitOptions) {
  const bucket = new Map<string, RateLimitState>();

  return (key: string) => {
    const now = Date.now();
    const entry = bucket.get(key);
    if (!entry || entry.resetAt <= now) {
      bucket.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfterMs: windowMs };
    }
    if (entry.count >= max) {
      return { ok: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
    }
    entry.count += 1;
    return { ok: true, retryAfterMs: Math.max(0, entry.resetAt - now) };
  };
}
