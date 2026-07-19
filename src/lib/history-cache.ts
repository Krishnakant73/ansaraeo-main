// ============================================================
// history-cache.ts — small in-memory TTL cache for historical READ APIs.
//
// WHY: history_observations / history_events only change when a visibility
// run happens (nightly cron or on-demand). The dashboard + the chat Agent
// both re-read the same brand's history constantly, so a short-lived cache
// cuts DB load dramatically for zero user-visible staleness.
//
// SAFETY: the cache key ALWAYS includes brandId, so two different brands can
// never share a cached payload. (We deliberately do NOT use a public CDN
// Cache-Control header keyed only by URL, because the brand is resolved from
// the auth cookie — a URL-only cache would leak brand A's history to brand B.)
//
// This is module-scoped memory (per server instance). It's a cache, not a
// store: a miss or an eviction just falls through to the DB, and the TTL is
// short. No correctness depends on it.
// ============================================================

type Entry = { expires: number; value: unknown };

const store = new Map<string, Entry>();

/** Default 2-minute TTL. History is slow-moving; this is plenty of freshness. */
export const HISTORY_CACHE_TTL_MS = 120_000;

export function historyCacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter((p) => p != null && p !== "").join("|");
}

export async function cachedHistory<T>(
  key: string,
  ttlMs: number = HISTORY_CACHE_TTL_MS,
  producer: () => Promise<T>,
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

/** Drop every cached entry (used by writes so a just-recorded run is visible immediately). */
export function invalidateHistoryCache(brandId?: string): void {
  if (!brandId) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.includes(brandId)) store.delete(key);
  }
}
