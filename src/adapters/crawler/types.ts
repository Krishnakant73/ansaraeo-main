// Crawler adapter port. The CrawlerService binds one of these based on
// CRAWLER_PROVIDER env. Constitution: "application should only call crawl(url)".

export type CrawlOptions = {
  jsEnabled?: boolean;
  waitForSelector?: string;
  timeoutMs?: number;
};

export type CrawlResult = {
  url: string;
  status: number;
  markdown: string;
  html: string;
  links: string[];
  // "firecrawl" | "crawl4ai" | "cheerio" — surfaced to callers that
  // want to warn when they got a fallback rather than a JS-rendered result.
  source: string;
};

export interface CrawlerAdapter {
  readonly provider: string;
  crawl(url: string, opts?: CrawlOptions): Promise<CrawlResult>;
}
