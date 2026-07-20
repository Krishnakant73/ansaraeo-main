// Upstash Redis REST adapter. HTTP-only client — no persistent TCP required,
// which matters on Vercel serverless where each invocation is short-lived.
//
// Uses `fetch` directly to avoid pulling in another SDK. Upstash's REST API
// accepts commands as a single-array path in the URL body.
// https://upstash.com/docs/redis/features/restapi

import type { CacheAdapter } from "./types";

export class UpstashCacheAdapter implements CacheAdapter {
  constructor(
    private readonly restUrl: string,
    private readonly token: string,
  ) {}

  private async command<T = unknown>(args: (string | number)[]): Promise<T | null> {
    const res = await fetch(this.restUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      // Never cache the cache itself.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { result: T | null; error?: string };
    if (data.error) throw new Error(`Upstash: ${data.error}`);
    return data.result;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.command<string | null>(["GET", key]);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const args: (string | number)[] = ["SET", key, JSON.stringify(value)];
    if (ttlSeconds) args.push("EX", ttlSeconds);
    await this.command(args);
  }

  async del(key: string): Promise<void> {
    await this.command(["DEL", key]);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const next = (await this.command<number>(["INCR", key])) ?? 0;
    if (ttlSeconds && next === 1) {
      await this.command(["EXPIRE", key, ttlSeconds]);
    }
    return next;
  }
}
