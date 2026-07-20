// RateLimitService — token-bucket-lite backed by the CacheAdapter.
// Not a full leaky-bucket implementation — one atomic INCR per window,
// which is enough for per-user + per-route + per-org budgets in a
// serverless environment.
//
// Every /api/v1/* route should call this before doing real work.
// See constitution's Security & Performance sections.

import { getCache } from "@/adapters/cache";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
};

export interface RateLimitService {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

class DefaultRateLimitService implements RateLimitService {
  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const cache = getCache();
    const bucketKey = `rl:${bucketOf(windowSeconds)}:${key}`;
    let count = 0;
    try {
      count = await cache.incr(bucketKey, windowSeconds);
    } catch {
      // Cache unreachable — fail OPEN (allow) rather than lock users out.
      // Log at the caller if this becomes frequent; monitoring/monitoring.ts
      // is the place for the alert.
      return { allowed: true, remaining: limit, resetAtMs: Date.now() + windowSeconds * 1000 };
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAtMs: (bucketOf(windowSeconds) + 1) * windowSeconds * 1000,
    };
  }
}

// Discrete window boundary in the epoch. Two requests in the same window
// share the same bucket → the INCR atomically produces the shared counter.
function bucketOf(windowSeconds: number): number {
  return Math.floor(Date.now() / 1000 / windowSeconds);
}

let _instance: DefaultRateLimitService | null = null;
export function getRateLimitService(): RateLimitService {
  if (!_instance) _instance = new DefaultRateLimitService();
  return _instance;
}
