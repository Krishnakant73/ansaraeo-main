// ============================================================
// Competitor Topical Coverage (Batch 35 — from the "skills" repos)
//
// Crawls the brand's sitemap AND each competitor's sitemap (bounded) and builds
// a cross-domain topical-coverage comparison: which topic/keyword clusters the
// competitors cover that the brand does NOT (content gaps to close), and which
// the brand covers that competitors don't (strengths to defend).
//
// This extends the single-domain "topical authority / pillar clustering" idea
// already in the Site Audit into a *competitive* view. It is deterministic and
// honest: topics are derived from the real URL structure of each sitemap — no
// LLM, no estimation, nothing fabricated. Analysis only (nothing persisted).
//
// Inspired by the competitive/SEO "skills" repos in the evaluated batch
// (e.g. metawhisp/amazing-seo-skill, angeo-dev/module-aeo-audit,
// AntonioBlago/peec-ai-skills) — implemented from first principles.
// ============================================================

const MAX_PAGES = 40;
const CONCURRENCY = 8;
const PAGE_TIMEOUT = 9000;

const STOPWORDS = new Set(
  (
    "a an the and or but if then else for to of in on at by with from as is are was were be been being this that these those it its we you your they their he she his her them our us i me my mine do does did done have has had will would can could should may might must not no nor so than too very just also into out up down over under again about above below between off near here there where when which who whom whose what why how all any both each few more most other some such only own same www html php asp aspx jsp index p page tag tags category categories author search sitemap privacy terms about contact cart login account checkout cart"
  ).split(/\s+/)
);

export type TopicToken = {
  token: string;
  brandHas: boolean;
  competitorDomains: string[];
  competitorCount: number;
};

export type TopicalCoverageResult = {
  brandDomain: string;
  competitors: { domain: string; pages: number; tokens: number }[];
  gapTokens: TopicToken[];
  strengthTokens: TopicToken[];
  notes: string[];
};

export function extractTokens(urls: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const u of urls) {
    try {
      const path = new URL(u).pathname.toLowerCase();
      for (const seg of path.split(/[/_\-]+/)) {
        const t = seg.replace(/[^a-z0-9]/g, "");
        if (t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t)) tokens.add(t);
      }
    } catch {
      /* ignore malformed */
    }
  }
  return tokens;
}

// Pure analysis over already-fetched URL lists — easy to unit-test without a fetch stub.
export function buildTopicalCoverage(
  brandDomain: string,
  brandUrls: string[],
  competitors: { domain: string; urls: string[] }[]
): TopicalCoverageResult {
  const brandTokens = extractTokens(brandUrls);
  const compTokensMap = new Map<string, Set<string>>();
  const compSummary = competitors.map((c) => {
    const t = extractTokens(c.urls);
    for (const tok of t) {
      if (!compTokensMap.has(tok)) compTokensMap.set(tok, new Set());
      compTokensMap.get(tok)!.add(c.domain);
    }
    return { domain: c.domain, pages: c.urls.length, tokens: t.size };
  });

  const gapTokens: TopicToken[] = [];
  const strengthTokens: TopicToken[] = [];
  const allTokens = new Set<string>([...brandTokens, ...compTokensMap.keys()]);
  for (const tok of allTokens) {
    const comps = [...(compTokensMap.get(tok) ?? [])];
    const inBrand = brandTokens.has(tok);
    if (!inBrand && comps.length > 0) {
      gapTokens.push({ token: tok, brandHas: false, competitorDomains: comps, competitorCount: comps.length });
    } else if (inBrand && comps.length === 0) {
      strengthTokens.push({ token: tok, brandHas: true, competitorDomains: [], competitorCount: 0 });
    }
  }
  gapTokens.sort((a, b) => b.competitorCount - a.competitorCount || a.token.localeCompare(b.token));
  strengthTokens.sort((a, b) => a.token.localeCompare(b.token));

  return {
    brandDomain,
    competitors: compSummary,
    gapTokens,
    strengthTokens,
    notes: [
      "Topics are derived deterministically from each sitemap's URL structure (path segments/tokens) — a transparent heuristic, not an LLM estimate.",
      `Comparing ${brandDomain} against ${compSummary.length} competitor(s); up to ${MAX_PAGES} pages read per sitemap.`,
    ],
  };
}

async function safeFetchText(url: string): Promise<{ status: number | null; text: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AnsarAEO-TopicalBot/1.0 (+https://ansaraeo.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT),
    });
    if (!res.ok) return { status: res.status, text: null };
    return { status: res.status, text: await res.text() };
  } catch {
    return { status: null, text: null };
  }
}

function parseSitemapLocs(xml: string, limit: number): string[] {
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
  return locs.slice(0, limit);
}

function normalizeDomain(u: string): string {
  try {
    const url = new URL(u.startsWith("http") ? u : `https://${u}`);
    return `${url.protocol}//${url.host.toLowerCase()}`;
  } catch {
    return u;
  }
}

async function sitemapUrls(domain: string): Promise<string[]> {
  const base = normalizeDomain(domain);
  const sm = await safeFetchText(`${base}/sitemap.xml`);
  if (!sm.text) return [];
  let locs = parseSitemapLocs(sm.text, MAX_PAGES);
  if (locs.length && /sitemap/i.test(locs[0]) && /\.xml$/i.test(locs[0]) && !/<url>/i.test(sm.text)) {
    const child = await safeFetchText(locs[0]);
    if (child.text) locs = parseSitemapLocs(child.text, MAX_PAGES);
  }
  return locs;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function analyzeTopicalCoverage(params: {
  url: string;
  competitors: string[];
}): Promise<TopicalCoverageResult> {
  const brandDomain = normalizeDomain(params.url);
  const brandUrls = await sitemapUrls(brandDomain);
  const comps = [...new Set(params.competitors.map((c) => c.trim()).filter(Boolean))];

  const competitorData = await mapWithConcurrency(comps, CONCURRENCY, async (domain) => ({
    domain: normalizeDomain(domain),
    urls: await sitemapUrls(domain),
  }));

  const filtered = competitorData.filter((c) => c.urls.length > 0);
  const notes: string[] = [];
  const missing = comps.filter((_, i) => competitorData[i].urls.length === 0);
  if (missing.length) {
    notes.push(
      `Could not read a sitemap for: ${missing.join(", ")} — check the domain is correct and sitemap.xml is reachable.`
    );
  }

  const result = buildTopicalCoverage(brandDomain, brandUrls, filtered);
  return { ...result, notes: [...notes, ...result.notes] };
}
