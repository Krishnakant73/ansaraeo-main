// Cache port. Any adapter conforming to this interface can back the LLM
// prompt-hash cache + rate-limit counters + short-TTL derived data.

export interface CacheAdapter {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  // Atomic increment; returns the new value. Used for rate limiters.
  incr(key: string, ttlSeconds?: number): Promise<number>;
}
