// Composition: reads CRAWLER_PROVIDER env and returns the right adapter.
// Falls back down the chain if the preferred provider is not configured:
//   firecrawl → crawl4ai → cheerio
//
// Never throws for missing config — cheerio is always available.

import { CheerioAdapter } from "./cheerio-adapter";
import { Crawl4AIAdapter } from "./crawl4ai-adapter";
import { FirecrawlAdapter } from "./firecrawl-adapter";
import type { CrawlerAdapter } from "./types";

export type { CrawlerAdapter, CrawlOptions, CrawlResult } from "./types";

let _instance: CrawlerAdapter | null = null;

export function getCrawlerAdapter(): CrawlerAdapter {
  if (_instance) return _instance;

  const preferred = process.env.CRAWLER_PROVIDER ?? "crawl4ai";

  if (preferred === "firecrawl" && process.env.FIRECRAWL_API_KEY) {
    _instance = new FirecrawlAdapter(process.env.FIRECRAWL_API_KEY);
    return _instance;
  }

  if (preferred === "crawl4ai" && process.env.CRAWL4AI_API_URL && process.env.CRAWL4AI_API_KEY) {
    _instance = new Crawl4AIAdapter(process.env.CRAWL4AI_API_URL, process.env.CRAWL4AI_API_KEY);
    return _instance;
  }

  // Fallback chain if the preferred provider isn't configured.
  if (process.env.FIRECRAWL_API_KEY) {
    _instance = new FirecrawlAdapter(process.env.FIRECRAWL_API_KEY);
    return _instance;
  }
  if (process.env.CRAWL4AI_API_URL && process.env.CRAWL4AI_API_KEY) {
    _instance = new Crawl4AIAdapter(process.env.CRAWL4AI_API_URL, process.env.CRAWL4AI_API_KEY);
    return _instance;
  }

  _instance = new CheerioAdapter();
  return _instance;
}

export function __resetCrawlerAdapter(): void {
  _instance = null;
}
