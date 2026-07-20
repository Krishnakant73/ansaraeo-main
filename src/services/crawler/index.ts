// CrawlerService — thin wrapper delegating to the configured CrawlerAdapter.
// Constitution rule: `application should only call crawl(url)`.

import type { CrawlOptions, CrawlResult } from "@/adapters/crawler";
import { getCrawlerAdapter } from "@/adapters/crawler";

export type { CrawlOptions, CrawlResult } from "@/adapters/crawler";

export interface CrawlerService {
  crawl(url: string, opts?: CrawlOptions): Promise<CrawlResult>;
}

class DefaultCrawlerService implements CrawlerService {
  crawl(url: string, opts?: CrawlOptions): Promise<CrawlResult> {
    return getCrawlerAdapter().crawl(url, opts);
  }
}

let _instance: DefaultCrawlerService | null = null;
export function getCrawlerService(): CrawlerService {
  if (!_instance) _instance = new DefaultCrawlerService();
  return _instance;
}

// Convenience — mirrors the constitution's `crawl(url)` API.
export async function crawl(url: string, opts?: CrawlOptions): Promise<CrawlResult> {
  return getCrawlerService().crawl(url, opts);
}
