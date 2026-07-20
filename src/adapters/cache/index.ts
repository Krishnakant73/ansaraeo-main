// Cache adapter composition. Selects the right implementation from env:
//   - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → Upstash REST
//   - otherwise → in-memory (dev/CI only)

import { MemoryCacheAdapter } from "./memory-adapter";
import { UpstashCacheAdapter } from "./upstash-adapter";
import type { CacheAdapter } from "./types";

export type { CacheAdapter } from "./types";

let _instance: CacheAdapter | null = null;

export function getCache(): CacheAdapter {
  if (_instance) return _instance;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _instance = new UpstashCacheAdapter(url, token);
  } else {
    _instance = new MemoryCacheAdapter();
  }
  return _instance;
}

// Test hook.
export function __resetCache(): void {
  _instance = null;
}
