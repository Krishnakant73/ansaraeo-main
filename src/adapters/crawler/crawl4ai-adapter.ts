// Crawl4AIAdapter — HTTP client for a self-hosted Crawl4AI sidecar service.
// Sidecar deployment is Modal / Fly / Render — see memory: crawl4ai-hosting.
//
// Pre-existing code lives in src/lib/crawl.ts; this adapter wraps the same
// contract behind the port so callers depend on CrawlerAdapter only.

import type { CrawlOptions, CrawlResult, CrawlerAdapter } from "./types";

const DEFAULT_TIMEOUT = 30_000;

export class Crawl4AIAdapter implements CrawlerAdapter {
  readonly provider = "crawl4ai";

  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
  ) {}

  async crawl(url: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
    const res = await fetch(`${this.apiUrl.replace(/\/$/, "")}/crawl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        urls: [url],
        js_enabled: opts.jsEnabled ?? true,
        wait_for: opts.waitForSelector,
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT,
      }),
    });
    if (!res.ok) throw new Error(`Crawl4AI error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      results: Array<{
        url: string;
        status_code: number;
        markdown?: string;
        html?: string;
        links?: { internal?: string[]; external?: string[] };
      }>;
    };
    const first = data.results[0];
    if (!first) throw new Error("Crawl4AI returned no results");
    return {
      url: first.url,
      status: first.status_code,
      markdown: first.markdown ?? "",
      html: first.html ?? "",
      links: [
        ...(first.links?.internal ?? []),
        ...(first.links?.external ?? []),
      ],
      source: "crawl4ai",
    };
  }
}
