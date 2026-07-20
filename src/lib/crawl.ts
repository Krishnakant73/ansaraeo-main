// crawl — thin client for a Crawl4AI sidecar service.
//
// Crawl4AI (unclecode/crawl4ai) is a Python-only library and cannot run
// inside Next.js on Vercel. We deploy it separately (Modal/Fly/Render) and
// hit its HTTP API from here. When CRAWL4AI_API_URL is unset, we fall back
// to the existing raw-fetch + cheerio pipeline (same one site-audit-engine
// uses) so this module is safe to import even without the sidecar.
//
// See memory: crawl4ai-hosting.md for the deployment decision.

import { getCrawl4AIConfig } from "@/lib/env";
import * as cheerio from "cheerio";

export type CrawlResult = {
  url: string;
  status: number;
  markdown: string;
  html: string;
  links: string[];
  // "crawl4ai" when the sidecar answered, "fallback" when we degraded to
  // plain fetch. Callers that need JS-rendered content should check this
  // and warn when they're on the fallback path.
  source: "crawl4ai" | "fallback";
};

export type CrawlOptions = {
  // Passed to Crawl4AI; ignored by the fallback path.
  jsEnabled?: boolean;
  waitForSelector?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_UA =
  "Mozilla/5.0 (compatible; AnsarAEOBot/1.0; +https://ansaraeo.com/bot)";

export async function crawl(url: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const cfg = getCrawl4AIConfig();
  if (cfg) return crawlViaSidecar(url, opts, cfg);
  return crawlViaFetch(url, opts);
}

async function crawlViaSidecar(
  url: string,
  opts: CrawlOptions,
  cfg: { apiUrl: string; apiKey: string },
): Promise<CrawlResult> {
  const res = await fetch(`${cfg.apiUrl}/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
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
  const links = [
    ...(first.links?.internal ?? []),
    ...(first.links?.external ?? []),
  ];
  return {
    url: first.url,
    status: first.status_code,
    markdown: first.markdown ?? "",
    html: first.html ?? "",
    links,
    source: "crawl4ai",
  };
}

async function crawlViaFetch(url: string, opts: CrawlOptions): Promise<CrawlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": DEFAULT_UA, Accept: "text/html,*/*" },
      signal: controller.signal,
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    // Strip scripts/styles so the "markdown" approximation is readable.
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
      source: "fallback",
    };
  } finally {
    clearTimeout(timer);
  }
}
