// ============================================================
// HTTP Header & Discovery Link-Graph (Batch 34)
//
// Crawls the brand's sitemap (bounded) and reads each page's *HTTP response
// headers* — not the body — to build a "header link graph" and surface the
// AI-discovery signals that robots.txt / the homepage-only Site Audit cannot:
//   - per-page <link rel="canonical"> presence
//   - per-page advertisement of an AI index (Link rel="llms.txt" / "ai.txt",
//     or the X-Llms-Txt response header)
//   - per-page AI-blocking via X-Robots-Tag (noindex / nosnippet — robots.txt
//     can express site-wide rules but NOT per-URL directives)
//   - the directed graph of Link-header relationships across the site
//
// This complements (does not duplicate) the Internal Link Graph (which walks
// <a> body links), the Site Audit (homepage snapshot only) and the Robots
// Validator (robots.txt parse). Deterministic, no LLM, no DB — every verdict
// comes from a real fetch of the brand's own response headers (honesty).
// ============================================================

const MAX_PAGES = 50;
const CONCURRENCY = 8;
const PAGE_TIMEOUT = 9000;

export type ParsedLink = { uri: string; rel: string; type?: string };

export type PageHeader = {
  url: string;
  status: number | null;
  canonical: string | null;
  advertisesLlmsTxt: boolean;
  advertisesAiTxt: boolean;
  xRobotsTag: string | null;
  blocksAi: boolean;
  contentType: string | null;
  linkHeaders: ParsedLink[];
};

export type HeaderLinkEdge = { from: string; rel: string; to: string; internal: boolean };

export type HeaderLinkFinding = {
  pattern: string;
  severity: "high" | "medium" | "low" | "info";
  detail: string;
  pages?: string[];
};

export type HeaderLinkGraphResult = {
  domain: string;
  crawledPages: number;
  sitemapPages: number;
  pages: PageHeader[];
  edges: HeaderLinkEdge[];
  findings: HeaderLinkFinding[];
  summary: {
    missingCanonical: number;
    advertisingLlmsTxt: number;
    blockingAi: number;
    errors: number;
    orphanHeaderLinks: number;
  };
  notes: string[];
};

// Relationship rels worth graphing (excludes stylesheet/icon/preload-asset noise
// unless the asset is an AI-discovery document).
const GRAPH_RELS = new Set([
  "canonical",
  "alternate",
  "preload",
  "next",
  "prev",
  "index",
  "chapter",
  "section",
  "hub",
  "appendix",
  "bookmark",
  "llms.txt",
  "ai.txt",
]);

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    url.search = "";
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.host.toLowerCase()}${path}`;
  } catch {
    return u;
  }
}

// Parse one or more Link header values into structured links.
// A Link header value is a comma-joined list of `<uri>; rel="x"; type="y"`.
// We split on commas that precede a new `<` so commas inside URIs are safe.
export function parseLinkHeader(raw: string | null | undefined): ParsedLink[] {
  if (!raw) return [];
  const links: ParsedLink[] = [];
  const re = /<([^>]*)>\s*;\s*([^,]*?)(?=,\s*<|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const uri = m[1].trim();
    const params = m[2] ?? "";
    const relMatch = /rel\s*=\s*"?([^";]+)"?/.exec(params);
    const typeMatch = /type\s*=\s*"?([^";]+)"?/.exec(params);
    if (!uri) continue;
    links.push({
      uri,
      rel: (relMatch?.[1] ?? "").trim().toLowerCase().replace(/^"|"$/g, ""),
      type: typeMatch?.[1]?.trim().replace(/^"|"$/g, ""),
    });
  }
  return links;
}

async function safeFetchText(url: string): Promise<{ status: number | null; text: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AnsarAEO-HeaderGraphBot/1.0 (+https://ansaraeo.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT),
    });
    if (!res.ok) return { status: res.status, text: null };
    return { status: res.status, text: await res.text() };
  } catch {
    return { status: null, text: null };
  }
}

// Fetch only the response headers (HEAD, falling back to GET when HEAD is
// unsupported). The body is never read.
async function fetchHeaders(url: string): Promise<{ status: number | null; headers: Map<string, string> }> {
  const read = async (method: string) => {
    const res = await fetch(url, {
      method,
      headers: { "User-Agent": "AnsarAEO-HeaderGraphBot/1.0 (+https://ansaraeo.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT),
    });
    const map = new Map<string, string>();
    res.headers.forEach((v, k) => map.set(k.toLowerCase(), v));
    return { status: res.status, headers: map };
  };
  try {
    const head = await read("HEAD");
    if (head.status !== null && head.status !== 405 && head.status !== 501) return head;
    return await read("GET");
  } catch {
    return { status: null, headers: new Map() };
  }
}

function parseSitemapLocs(xml: string, limit: number): string[] {
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
  return locs.slice(0, limit);
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

export async function analyzeHeaderLinks(params: { url: string }): Promise<HeaderLinkGraphResult> {
  const baseUrl = normalizeUrl(params.url.startsWith("http") ? params.url : `https://${params.url}`);
  const baseHost = new URL(baseUrl).host;
  const homepage = normalizeUrl(baseUrl);
  const notes: string[] = [];

  // 1. Sitemap → seed URLs
  let sitemapLocs: string[] = [];
  const smRes = await safeFetchText(`${baseUrl}/sitemap.xml`);
  if (smRes.text) {
    let locs = parseSitemapLocs(smRes.text, MAX_PAGES);
    if (locs.length && /sitemap/i.test(locs[0]) && /\.xml$/i.test(locs[0]) && !/<url>/i.test(smRes.text)) {
      const childRes = await safeFetchText(locs[0]);
      if (childRes.text) locs = parseSitemapLocs(childRes.text, MAX_PAGES);
    }
    sitemapLocs = locs;
  }
  if (sitemapLocs.length === 0) {
    notes.push("No sitemap.xml found — cannot crawl. Publish a sitemap to enable header-link analysis.");
    return {
      domain: baseUrl,
      crawledPages: 0,
      sitemapPages: 0,
      pages: [],
      edges: [],
      findings: [],
      summary: { missingCanonical: 0, advertisingLlmsTxt: 0, blockingAi: 0, errors: 0, orphanHeaderLinks: 0 },
      notes,
    };
  }
  notes.push(`Reading HTTP headers from up to ${MAX_PAGES} of ${sitemapLocs.length} sitemap URLs.`);
  notes.push(
    "Header verdicts are a deterministic read of each page's live HTTP response headers (Link, X-Robots-Tag) — exact, not estimated."
  );

  // 2. Fetch headers per page
  const seedUrls = sitemapLocs.map(normalizeUrl);
  const crawled: PageHeader[] = await mapWithConcurrency(seedUrls, CONCURRENCY, async (url) => {
    const { status, headers } = await fetchHeaders(url);
    if (status === null) {
      return { url, status: null, canonical: null, advertisesLlmsTxt: false, advertisesAiTxt: false, xRobotsTag: null, blocksAi: false, contentType: null, linkHeaders: [] };
    }
    const linkRaw = headers.get("link");
    const xLlms = headers.get("x-llms-txt");
    const xRobots = headers.get("x-robots-tag");
    const links = parseLinkHeader(linkRaw);
    const canonical = links.find((l) => l.rel === "canonical")?.uri ?? null;
    const advertisesLlmsTxt = links.some((l) => l.rel === "llms.txt") || Boolean(xLlms);
    const advertisesAiTxt = links.some((l) => l.rel === "ai.txt");
    const blocksAi =
      !!xRobots && /(^|[\s,])no(index|snippet)([\s,]|$)/i.test(xRobots);
    return {
      url,
      status,
      canonical: canonical ? safeResolve(canonical, url) : null,
      advertisesLlmsTxt,
      advertisesAiTxt,
      xRobotsTag: xRobots ?? null,
      blocksAi,
      contentType: headers.get("content-type") ?? null,
      linkHeaders: links,
    };
  });

  // 3. Build the directed header-link graph
  const crawledSet = new Set(crawled.map((p) => p.url));
  const edges: HeaderLinkEdge[] = [];
  const orphanTargets = new Set<string>();
  for (const page of crawled) {
    for (const link of page.linkHeaders) {
      if (!GRAPH_RELS.has(link.rel)) continue;
      let to: string;
      try {
        to = new URL(link.uri, page.url).href;
      } catch {
        continue;
      }
      const internal = new URL(to).host === baseHost;
      edges.push({ from: page.url, rel: link.rel, to, internal });
      if (internal && !crawledSet.has(to) && to !== homepage) orphanTargets.add(to);
    }
  }

  // 4. Findings
  const findings: HeaderLinkFinding[] = [];
  const errorPages = crawled.filter((p) => p.status !== null && p.status >= 400).map((p) => p.url);
  const blockingPages = crawled.filter((p) => p.blocksAi).map((p) => p.url);
  const missingCanonical = crawled.filter((p) => p.status !== null && p.status < 400 && !p.canonical).map((p) => p.url);
  const notAdvertisingHome = !crawled.find((p) => p.url === homepage)?.advertisesLlmsTxt;

  if (errorPages.length) {
    findings.push({
      pattern: "Pages returning HTTP errors",
      severity: "high",
      detail: `${errorPages.length} crawled page(s) returned a 4xx/5xx status — AI crawlers cannot read them.`,
      pages: errorPages.slice(0, 30),
    });
  }
  if (blockingPages.length) {
    findings.push({
      pattern: "X-Robots-Tag blocking AI indexing/snippets",
      severity: "high",
      detail:
        "These pages send an X-Robots-Tag with noindex/nosnippet. Unlike robots.txt (site-wide), this per-URL directive stops AI engines from indexing the page or quoting it in answers. robots.txt cannot express this.",
      pages: blockingPages.slice(0, 30),
    });
  }
  if (missingCanonical.length) {
    findings.push({
      pattern: "Missing canonical link",
      severity: "medium",
      detail: `${missingCanonical.length} crawlable page(s) send no <link rel="canonical"> header — AI engines may struggle to pick the canonical version, risking duplicate-content confusion.`,
      pages: missingCanonical.slice(0, 30),
    });
  }
  if (notAdvertisingHome) {
    findings.push({
      pattern: "Homepage does not advertise an AI index",
      severity: "medium",
      detail:
        "The homepage sends no Link rel=\"llms.txt\"/\"ai.txt\" and no X-Llms-Txt header. Pointing AI crawlers at your machine-readable index helps them discover your citable facts.",
      pages: [homepage],
    });
  }
  const advertisingCount = crawled.filter((p) => p.advertisesLlmsTxt).length;
  if (crawled.length && advertisingCount === 0) {
    findings.push({
      pattern: "No page advertises an AI index",
      severity: "low",
      detail: "No crawled page advertises llms.txt/ai.txt. Consider adding a Link rel=\"llms.txt\" (or X-Llms-Txt) on key pages.",
    });
  }

  return {
    domain: baseUrl,
    crawledPages: crawled.filter((p) => p.status !== null && p.status < 400).length,
    sitemapPages: seedUrls.length,
    pages: crawled,
    edges,
    findings,
    summary: {
      missingCanonical: missingCanonical.length,
      advertisingLlmsTxt: advertisingCount,
      blockingAi: blockingPages.length,
      errors: errorPages.length,
      orphanHeaderLinks: orphanTargets.size,
    },
    notes,
  };
}

function safeResolve(uri: string, base: string): string {
  try {
    return new URL(uri, base).href;
  } catch {
    return uri;
  }
}
