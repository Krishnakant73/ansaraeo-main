// ============================================================
// benchmark-cache.ts — short-lived in-memory TTL cache for benchmark READ APIs.
//
// Benchmark aggregates only change when the daily cron recomputes them, so a
// longer TTL than history is safe. Same safety model as history-cache.ts:
// cache keys always include the scoping identity (brandId / dimension) so two
// brands / two dimension contexts can never share a payload. Module-scoped
// memory, per server instance — a miss just falls through to the DB.
// ============================================================

type Entry = { expires: number; value: unknown };

const store = new Map<string, Entry>();

/** 1-hour TTL: benchmark aggregates are recomputed at most daily. */
export const BENCHMARK_CACHE_TTL_MS = 3_600_000;

export function benchmarkCacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter((p) => p != null && p !== "").join("|");
}

export async function cachedBenchmark<T>(
  key: string,
  producer: () => Promise<T>,
  ttlMs: number = BENCHMARK_CACHE_TTL_MS,
): Promise<{ data: T; fromCache: boolean }> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return { data: hit.value as T, fromCache: true };
  }
  const data = await producer();
  store.set(key, { expires: now + ttlMs, value: data });
  return { data, fromCache: false };
}

/** Drop every cached entry (used after a recompute so fresh aggregates show). */
export function invalidateBenchmarkCache(): void {
  store.clear();
}
