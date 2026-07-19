import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseLinkHeader, analyzeHeaderLinks } from "./header-link-graph";

function makeHeaders(entries: Record<string, string>) {
  return {
    get(key: string) {
      return entries[key.toLowerCase()] ?? null;
    },
    forEach(fn: (v: string, k: string) => void) {
      for (const [k, v] of Object.entries(entries)) fn(v, k);
    },
  } as unknown as Headers;
}

function mockFetch(handler: (url: string, method: string) => { status: number; headers?: Record<string, string>; body?: string }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const { status, headers, body } = handler(url, method);
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: makeHeaders(headers ?? {}),
        text: async () => body ?? "",
      };
    })
  );
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("parseLinkHeader", () => {
  it("parses multiple link values with rel + type", () => {
    const raw =
      '<https://ex.com/page/>; rel="canonical", <https://ex.com/llms.txt>; rel="llms.txt"; type="text/plain"';
    const links = parseLinkHeader(raw);
    expect(links.length).toBe(2);
    expect(links[0]).toMatchObject({ uri: "https://ex.com/page/", rel: "canonical" });
    expect(links[1]).toMatchObject({ uri: "https://ex.com/llms.txt", rel: "llms.txt", type: "text/plain" });
  });

  it("returns an empty array for null/empty input", () => {
    expect(parseLinkHeader(null)).toEqual([]);
    expect(parseLinkHeader("")).toEqual([]);
  });

  it("does not break on commas inside a URI", () => {
    const raw = '<https://ex.com/s?a=1,b=2>; rel="canonical"';
    const links = parseLinkHeader(raw);
    expect(links.length).toBe(1);
    expect(links[0].uri).toBe("https://ex.com/s?a=1,b=2");
  });
});

describe("analyzeHeaderLinks", () => {
  it("builds a header graph and flags per-page AI blocks / missing canonical", async () => {
    const sitemap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://ex.com/</loc></url>
      <url><loc>https://ex.com/about</loc></url>
    </urlset>`;

    mockFetch((url): { status: number; headers: Record<string, string>; body?: string } => {
      if (url.endsWith("/sitemap.xml")) {
        return { status: 200, body: sitemap, headers: { "content-type": "application/xml" } };
      }
      if (url === "https://ex.com/") {
        return {
          status: 200,
          headers: {
            link: '<https://ex.com/>; rel="canonical", <https://ex.com/llms.txt>; rel="llms.txt"',
            "content-type": "text/html",
          },
        };
      }
      // /about: no canonical, blocked by X-Robots-Tag
      return {
        status: 200,
        headers: { "x-robots-tag": "noindex, nosnippet", "content-type": "text/html" },
      };
    });

    const res = await analyzeHeaderLinks({ url: "https://ex.com" });

    expect(res.crawledPages).toBe(2);
    expect(res.summary.advertisingLlmsTxt).toBe(1); // homepage only
    expect(res.summary.blockingAi).toBe(1);
    expect(res.summary.missingCanonical).toBe(1); // /about

    // canonical + llms.txt edges present
    const rels = res.edges.map((e) => e.rel);
    expect(rels).toContain("canonical");
    expect(rels).toContain("llms.txt");

    // High-severity findings fire
    expect(res.findings.some((f) => f.pattern === "X-Robots-Tag blocking AI indexing/snippets")).toBe(true);
    expect(res.findings.some((f) => f.pattern === "Missing canonical link")).toBe(true);
    // Homepage advertises llms.txt → that medium finding must NOT fire
    expect(res.findings.some((f) => f.pattern === "Homepage does not advertise an AI index")).toBe(false);
  });

  it("reports a note and no pages when there is no sitemap", async () => {
    mockFetch((url): { status: number; headers: Record<string, string>; body?: string } => {
      if (url.endsWith("/sitemap.xml")) return { status: 404, headers: {} };
      return { status: 200, headers: {} };
    });

    const res = await analyzeHeaderLinks({ url: "https://ex.com" });
    expect(res.crawledPages).toBe(0);
    expect(res.pages.length).toBe(0);
    expect(res.notes.some((n) => n.includes("No sitemap.xml"))).toBe(true);
  });
});
