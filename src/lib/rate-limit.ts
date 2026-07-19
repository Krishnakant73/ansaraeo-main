// In-memory fixed-window rate limiter. Zero dependencies.
//
// This stops the most trivial abuse today (a single client hammering an
// unauthenticated trigger route). For multi-instance production, front this
// with Redis or a managed limiter — but the call sites are already wired so
// swapping the implementation is a one-line change.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; resetMs: number };

export function createRateLimiter(opts: { windowMs: number; max: number }) {
  return function limit(key: string): RateLimitResult {
    // Bound the Map so warm serverless containers don't leak memory.
    if (buckets.size > 10_000) buckets.clear();

    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + opts.windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { ok: true, remaining: opts.max - 1, resetMs: resetAt - now };
    }

    if (existing.count >= opts.max) {
      return { ok: false, remaining: 0, resetMs: existing.resetAt - now };
    }

    existing.count += 1;
    return { ok: true, remaining: opts.max - existing.count, resetMs: existing.resetAt - now };
  };
}
