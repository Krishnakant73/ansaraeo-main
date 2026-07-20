// Tavily search client — web search API tuned for LLM agents.
//
// Not currently wired into any caller. Added in Batch G as capability the
// competitor-intel and content-gap modules can adopt later.
//
// Skip-not-throw when TAVILY_API_KEY is unset — same discipline as callGrok
// in src/lib/visibility-engine.ts.

import { getTavilyApiKey } from "@/lib/env";

export type TavilySearchDepth = "basic" | "advanced";

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
};

export type TavilyResponse = {
  results: TavilyResult[];
  answer?: string;
  query: string;
  responseTime: number;
};

export type TavilyOptions = {
  depth?: TavilySearchDepth;
  maxResults?: number;
  // includeAnswer=true asks Tavily to return an LLM-synthesized answer
  // alongside the raw results. Useful when the caller wants a first pass
  // before deciding which URLs to crawl in full.
  includeAnswer?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
};

// Returns null when TAVILY_API_KEY is unset. Callers should treat this as
// "search unavailable" and degrade — never surface it as an error to users.
export async function tavilySearch(
  query: string,
  opts: TavilyOptions = {},
): Promise<TavilyResponse | null> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) return null;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      search_depth: opts.depth ?? "basic",
      max_results: opts.maxResults ?? 5,
      include_answer: opts.includeAnswer ?? false,
      include_domains: opts.includeDomains,
      exclude_domains: opts.excludeDomains,
    }),
  });
  if (!res.ok) throw new Error(`Tavily error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    results: Array<{ title: string; url: string; content: string; score: number; published_date?: string }>;
    answer?: string;
    query: string;
    response_time: number;
  };
  return {
    results: data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      publishedDate: r.published_date,
    })),
    answer: data.answer,
    query: data.query,
    responseTime: data.response_time,
  };
}
