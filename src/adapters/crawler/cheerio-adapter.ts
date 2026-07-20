// CheerioAdapter — plain HTTP fetch + cheerio. Fastest path, no JS rendering.
// Used as fallback when no other crawler is configured, or when the caller
// explicitly requests static HTML.
//
// Same code path that src/lib/site-audit-engine.ts already uses today, so
// existing behavior is preserved 1:1 through this adapter.

import * as cheerio from "cheerio";
import type { CrawlOptions, CrawlResult, CrawlerAdapter } from "./types";

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_UA = "Mozilla/5.0 (compatible; AnsarAEOBot/1.0; +https://ansaraeo.com/bot)";

export class CheerioAdapter implements CrawlerAdapter {
  readonly provider = "cheerio";

  async crawl(url: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": DEFAULT_UA, Accept: "text/html,*/*" },
        signal: controller.signal,
      });
      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, noscript").remove();
      const text = $("body").text().replace(/\s+/g, " ").trim();
      const links: string[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (href) links.push(href);
      });
      return {
        url,
        status: res.status,
        markdown: text,
        html,
        links,
        source: "cheerio",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
