// In-memory cache adapter. Fallback when Redis isn't configured (local dev,
// CI, feature previews). NOT for production — process-local, doesn't survive
// serverless cold starts, doesn't coordinate across regions.

import type { CacheAdapter } from "./types";

type Entry = { value: unknown; expiresAt: number };

export class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== 0 && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const current = ((await this.get<number>(key)) ?? 0) + 1;
    await this.set(key, current, ttlSeconds);
    return current;
  }
}
