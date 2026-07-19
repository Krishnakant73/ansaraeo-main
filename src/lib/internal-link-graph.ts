// ============================================================
// Internal Link Graph + Keyword Cannibalization (Batch 30 — "full crawler")
//
// Walks the brand's sitemap, fetches each page (bounded), and builds a
// directed internal-link graph so we can surface:
//   - orphans      (in sitemap, zero inbound internal links)
//   - dead-ends    (no outbound internal links)
//   - hubs         (highest in-degree)
//   - broken links (internal links pointing at a sitemap page that 404s)
//   - suggestions  (TF-IDF related-page link suggestions + anchor hints)
//   - cannibalization (pages competing for the same significant keyword)
//
// This is ANALYSIS ONLY (nothing persisted) and bounded by MAX_PAGES so it
// stays a reasonable on-demand job. Every verdict comes from a real fetch of
// the brand's own pages — no estimation, no fabrication (honesty principle).
// ============================================================

import * as cheerio from "cheerio";

const MAX_PAGES = 50;
const CONCURRENCY = 8;
const PAGE_TIMEOUT = 9000;

const STOPWORDS = new Set(
  (
    "a an the and or but if then else for to of in on at by with from as is are was were be been being this that these those it its it's we you your they their he she his her them our us i me my mine do does did done have has had will would can could should may might must not no nor so than too very just also into out up down over under again about above below between out off near here there where when which who whom whose what why how all any both each few more most other some such only own same s t can't don't won't"
  ).split(/\s+/)
);

export type LinkNode = {
  url: string;
  title: string;
  h1: string;
  status: number | null;
  inDegree: number;
  outDegree: number;
  brokenOut: number;
};

export type InternalLinkResult = {
  domain: string;
  crawledPages: number;
  sitemapPages: number;
  pages: LinkNode[];
  orphans: { url: string; title: string }[];
  deadEnds: { url: string; title: string }[];
  hubs: { url: string; title: string; inDegree: number }[];
  brokenLinks: { source: string; target: string; status: number | null }[];
  suggestions: { from: string; to: string; anchor: string; score: number }[];
  cannibalization: { keyword: string; pages: { url: string; title: string }[] }[];
  notes: string[];
};

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    url.search = "";
    let path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.host.toLowerCase()}${path}`;
  } catch {
    return u;
  }
}

async function safeFetch(url: string): Promise<{ status: number | null; html: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AnsarAEO-LinkGraphBot/1.0 (+https://ansaraeo.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT),
    });
    if (!res.ok) return { status: res.status, html: null };
    const html = await res.text();
    return { status: res.status, html };
  } catch {
    return { status: null, html: null };
  }
}

function parseSitemapLocs(xml: string, limit: number): string[] {
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
  return locs.slice(0, limit);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
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

export async function crawlInternalLinks(params: {
  domain: string;
  maxPages?: number;
}): Promise<InternalLinkResult> {
  const baseUrl = normalizeUrl(params.domain.startsWith("http") ? params.domain : `https://${params.domain}`);
  const baseHost = new URL(baseUrl).host;
  const maxPages = Math.min(params.maxPages ?? MAX_PAGES, MAX_PAGES);
  const notes: string[] = [];

  // 1. Sitemap → seed URLs
  let sitemapLocs: string[] = [];
  const smRes = await safeFetch(`${baseUrl}/sitemap.xml`);
  if (smRes.html) {
    let locs = parseSitemapLocs(smRes.html, maxPages);
    if (locs.length && /sitemap/i.test(locs[0]) && /\.xml$/i.test(locs[0]) && !/<url>/i.test(smRes.html)) {
      const childRes = await safeFetch(locs[0]);
      if (childRes.html) locs = parseSitemapLocs(childRes.html, maxPages);
    }
    sitemapLocs = locs;
  }
  if (sitemapLocs.length === 0) {
    notes.push("No sitemap.xml found — cannot crawl. Publish a sitemap to enable internal-link analysis.");
    return {
      domain: baseUrl,
      crawledPages: 0,
      sitemapPages: 0,
      pages: [],
      orphans: [],
      deadEnds: [],
      hubs: [],
      brokenLinks: [],
      suggestions: [],
      cannibalization: [],
      notes,
    };
  }
  notes.push(`Crawling up to ${maxPages} of ${sitemapLocs.length} sitemap URLs.`);

  // 2. Crawl each page, extracting links + metadata + text
  type Crawled = {
    url: string;
    title: string;
    h1: string;
    status: number | null;
    outLinks: string[];
    text: string;
  };

  const seedUrls = sitemapLocs.map(normalizeUrl);
  const crawled: Crawled[] = await mapWithConcurrency(seedUrls, CONCURRENCY, async (url) => {
    const { status, html } = await safeFetch(url);
    if (!html) {
      return { url, title: "", h1: "", status, outLinks: [], text: "" };
    }
    const $ = cheerio.load(html);
    const title = ($("title").first().text().trim() || $('meta[property="og:title"]').attr("content")?.trim() || "").slice(0, 120);
    const h1 = ($("h1").first().text().trim() || "").slice(0, 120);
    const outLinks: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const abs = new URL(href, url);
        if (abs.host === baseHost) outLinks.push(normalizeUrl(abs.href));
      } catch {
        /* ignore malformed */
      }
    });
    const text = $("body").text().replace(/\s+/g, " ").slice(0, 6000);
    return { url, title, h1, status, outLinks, text };
  });

  // 3. Build node map + adjacency (union of sitemap + discovered internal links)
  const nodeByUrl = new Map<string, Crawled>();
  for (const c of crawled) nodeByUrl.set(c.url, c);
  // Add any discovered internal targets not in the sitemap as nodes (status unknown).
  for (const c of crawled) {
    for (const l of c.outLinks) {
      if (!nodeByUrl.has(l)) nodeByUrl.set(l, { url: l, title: "", h1: "", status: null, outLinks: [], text: "" });
    }
  }

  const inLinks = new Map<string, Set<string>>();
  const outLinksMap = new Map<string, Set<string>>();
  for (const c of crawled) {
    const outs = new Set(c.outLinks);
    outLinksMap.set(c.url, outs);
    for (const l of outs) {
      if (!inLinks.has(l)) inLinks.set(l, new Set());
      inLinks.get(l)!.add(c.url);
    }
  }

  const statusByUrl = new Map<string, number | null>();
  for (const c of crawled) statusByUrl.set(c.url, c.status);

  const pages: LinkNode[] = Array.from(nodeByUrl.values()).map((c) => {
    const ins = inLinks.get(c.url) ?? new Set();
    const outs = outLinksMap.get(c.url) ?? new Set();
    let brokenOut = 0;
    for (const l of outs) {
      const st = statusByUrl.get(l);
      if (st != null && st >= 400) brokenOut++;
    }
    return {
      url: c.url,
      title: c.title || c.h1 || c.url,
      h1: c.h1,
      status: c.status,
      inDegree: ins.size,
      outDegree: outs.size,
      brokenOut,
    };
  });

  const pagesByUrl = new Map(pages.map((p) => [p.url, p]));

  // 4. Orphans / dead-ends / hubs / broken links
  const orphans = pages
    .filter((p) => p.inDegree === 0 && p.url !== baseUrl)
    .map((p) => ({ url: p.url, title: p.title }));

  const deadEnds = pages
    .filter((p) => p.outDegree === 0 && p.status !== null && p.status !== undefined && p.status < 400)
    .map((p) => ({ url: p.url, title: p.title }));

  const hubs = [...pages]
    .filter((p) => p.inDegree > 0)
    .sort((a, b) => b.inDegree - a.inDegree)
    .slice(0, 10)
    .map((p) => ({ url: p.url, title: p.title, inDegree: p.inDegree }));

  const brokenLinks: { source: string; target: string; status: number | null }[] = [];
  for (const p of pages) {
    if (p.status !== null && p.status !== undefined && p.status >= 400) {
      brokenLinks.push({ source: "(sitemap)", target: p.url, status: p.status });
    }
  }
  for (const c of crawled) {
    for (const l of c.outLinks) {
      const st = statusByUrl.get(l);
      if (st !== null && st !== undefined && st >= 400) {
        brokenLinks.push({ source: c.url, target: l, status: st });
      }
    }
  }

  // 5. TF-IDF related-page suggestions + keyword cannibalization
  const crawledWithText = crawled.filter((c) => c.text.length > 40);
  const docs = crawledWithText.map((c) => ({ url: c.url, title: c.title || c.h1 || c.url, tokens: tokenize(c.text), h1: c.h1 }));
  const N = docs.length;
  const df = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set(d.tokens);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  // Per-doc tfidf vectors (term -> weight)
  const vectors = docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const maxTf = Math.max(...tf.values());
    const vec = new Map<string, number>();
    for (const [t, f] of tf) {
      const idf = Math.log((N + 1) / (df.get(t) ?? 1));
      vec.set(t, (f / maxTf) * idf);
    }
    return { url: d.url, title: d.title, h1: d.h1, vec };
  });

  function cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    const smaller = a.size < b.size ? a : b;
    const other = smaller === a ? b : a;
    for (const [t, w] of smaller) {
      const ow = other.get(t);
      if (ow) dot += w * ow;
    }
    return dot;
  }

  const suggestions: { from: string; to: string; anchor: string; score: number }[] = [];
  const topTermsByDoc = new Map<string, Set<string>>();
  for (let i = 0; i < vectors.length; i++) {
    const a = vectors[i];
    const ranked = [...a.vec.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map((e) => e[0]);
    topTermsByDoc.set(a.url, new Set(ranked));
    const sims: { j: number; score: number }[] = [];
    for (let j = 0; j < vectors.length; j++) {
      if (i === j) continue;
      sims.push({ j, score: cosine(a.vec, vectors[j].vec) });
    }
    sims.sort((x, y) => y.score - x.score);
    let added = 0;
    for (const s of sims) {
      if (added >= 3) break;
      if (s.score < 0.02) continue;
      const b = vectors[s.j];
      // Only suggest links the page doesn't already have.
      const aOut = outLinksMap.get(a.url) ?? new Set();
      if (aOut.has(b.url)) continue;
      suggestions.push({ from: a.url, to: b.url, anchor: b.h1 || b.title, score: Number(s.score.toFixed(3)) });
      added++;
    }
  }

  // Cannibalization: pages sharing a top significant term.
  const termToDocs = new Map<string, string[]>();
  for (const [url, terms] of topTermsByDoc) {
    for (const t of terms) {
      if (!termToDocs.has(t)) termToDocs.set(t, []);
      termToDocs.get(t)!.push(url);
    }
  }
  const cannibalization: { keyword: string; pages: { url: string; title: string }[] }[] = [];
  for (const [term, urls] of termToDocs) {
    if (urls.length >= 2) {
      cannibalization.push({
        keyword: term,
        pages: urls.map((u) => {
          const p = pagesByUrl.get(u);
          return { url: u, title: p?.title ?? u };
        }),
      });
    }
  }
  cannibalization.sort((a, b) => b.pages.length - a.pages.length);
  const cannibalizationTrimmed = cannibalization.slice(0, 20);

  if (N < 2) notes.push("Too few crawlable pages with text to compute TF-IDF suggestions or cannibalization.");

  return {
    domain: baseUrl,
    crawledPages: crawled.filter((c) => c.status !== null && c.status !== undefined && c.status < 400).length,
    sitemapPages: seedUrls.length,
    pages,
    orphans,
    deadEnds,
    hubs,
    brokenLinks: brokenLinks.slice(0, 50),
    suggestions: suggestions.slice(0, 50),
    cannibalization: cannibalizationTrimmed,
    notes,
  };
}
