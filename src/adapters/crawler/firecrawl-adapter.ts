// FirecrawlAdapter — https://firecrawl.dev, managed crawler with JS rendering.
// Used as an alternative to the Crawl4AI sidecar for teams that don't want
// to host their own Python service.
//
// API docs: https://docs.firecrawl.dev/api-reference/endpoint/scrape

import type { CrawlOptions, CrawlResult, CrawlerAdapter } from "./types";

const DEFAULT_TIMEOUT = 30_000;

export class FirecrawlAdapter implements CrawlerAdapter {
  readonly provider = "firecrawl";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.firecrawl.dev/v1",
  ) {}

  async crawl(url: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
    try {
      const res = await fetch(`${this.baseUrl}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown", "html", "links"],
          waitFor: opts.waitForSelector ? 1000 : 0,
          timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Firecrawl error: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as {
        data?: {
          markdown?: string;
          html?: string;
          links?: string[];
          metadata?: { statusCode?: number; sourceURL?: string };
        };
      };
      const d = data.data ?? {};
      return {
        url: d.metadata?.sourceURL ?? url,
        status: d.metadata?.statusCode ?? 200,
        markdown: d.markdown ?? "",
        html: d.html ?? "",
        links: d.links ?? [],
        source: "firecrawl",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
