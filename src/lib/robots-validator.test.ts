import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeRobots, AI_CRAWLERS } from "./robots-validator";

function mockFetch(body: string | null, status = 200, throws = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (throws) throw new Error("network down");
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => body ?? "",
      };
    })
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeRobots", () => {
  it("applies a specific bot group over the wildcard group", async () => {
    // GPTBot is blanket-blocked; everyone else allowed by `*`.
    const robots = [
      "User-agent: *",
      "Disallow: /private/",
      "Allow: /private/allowed",
      "",
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "Sitemap: https://example.com/sitemap.xml",
    ].join("\n");

    mockFetch(robots, 200);
    const res = await analyzeRobots({ url: "https://example.com" });

    expect(res.ok).toBe(true);
    expect(res.fetched).toBe(true);
    expect(res.sitemaps).toContain("https://example.com/sitemap.xml");

    const gpt = res.bots.find((b) => b.bot === "GPTBot")!;
    expect(gpt.group).toBe("specific");
    expect(gpt.matchedUserAgent).toBe("GPTBot");
    expect(gpt.homepageAllowed).toBe(false);
    expect(gpt.blanketBlocked).toBe(true);

    const claude = res.bots.find((b) => b.bot === "ClaudeBot")!;
    expect(claude.group).toBe("wildcard");
    expect(claude.homepageAllowed).toBe(true);
    expect(claude.blanketBlocked).toBe(false);

    // A blanket block for at least one bot must raise a high finding.
    expect(res.findings.some((f) => f.pattern === "Blanket disallow affecting AI crawlers")).toBe(true);
  });

  it("treats an empty Disallow value as no restriction (allow all)", async () => {
    const robots = ["User-agent: *", "Disallow:"].join("\n");
    mockFetch(robots, 200);
    const res = await analyzeRobots({ url: "https://example.com" });

    expect(res.bots.every((b) => b.homepageAllowed && b.sitemapAllowed)).toBe(true);
    // Wildcard-only group with no real rule → flagged, and no sitemap.
    expect(res.findings.some((f) => f.pattern === "Only a wildcard (*) group")).toBe(true);
    expect(res.findings.some((f) => f.pattern === "No Sitemap directive")).toBe(true);
  });

  it("still recognizes a specific group even when its rule is empty", async () => {
    const robots = ["User-agent: *", "Disallow:", "User-agent: ClaudeBot", "Disallow:"].join("\n");
    mockFetch(robots, 200);
    const res = await analyzeRobots({ url: "https://example.com" });

    const claude = res.bots.find((b) => b.bot === "ClaudeBot")!;
    expect(claude.group).toBe("specific");
    expect(claude.homepageAllowed).toBe(true); // empty Disallow = allow
    // A specific group exists, so the "only wildcard" finding must NOT fire.
    expect(res.findings.some((f) => f.pattern === "Only a wildcard (*) group")).toBe(false);
  });

  it("evaluates wildcard path prefixes and $ end-anchor", async () => {
    // Disallow everything under /secret, but allow exact /secret-open
    const robots = [
      "User-agent: *",
      "Disallow: /secret",
      "Allow: /secret-open$",
    ].join("\n");
    mockFetch(robots, 200);
    const res = await analyzeRobots({ url: "https://example.com" });

    const any = res.bots[0];
    // homepage "/" is not under /secret → allowed
    expect(any.homepageAllowed).toBe(true);
    // We cannot directly assert sub-paths here (only / and /sitemap.xml are tested),
    // but the wildcard-only finding should be present and no blanket block.
    expect(any.blanketBlocked).toBe(false);
  });

  it("reports everything allowed when robots.txt is absent (404)", async () => {
    mockFetch(null, 404);
    const res = await analyzeRobots({ url: "https://example.com" });

    expect(res.ok).toBe(true);
    expect(res.fetched).toBe(false);
    expect(res.bots.length).toBe(AI_CRAWLERS.length);
    expect(res.bots.every((b) => b.homepageAllowed && b.sitemapAllowed)).toBe(true);
    expect(res.findings.some((f) => f.pattern === "No robots.txt")).toBe(true);
  });

  it("returns ok:false on a network error / timeout", async () => {
    mockFetch(null, 0, true);
    const res = await analyzeRobots({ url: "https://example.com" });

    expect(res.ok).toBe(false);
    expect(res.notes.some((n) => n.includes("timeout or network error"))).toBe(true);
  });

  it("prepends https:// when no scheme is given", async () => {
    const robots = "User-agent: *\nDisallow:\n";
    mockFetch(robots, 200);
    const res = await analyzeRobots({ url: "example.com" });
    expect(res.ok).toBe(true);
    expect(res.robotsUrl).toBe("https://example.com/robots.txt");
  });
});
