import { describe, expect, it } from "vitest";
import { buildScanReport, canonicalizeDomain, type ScanEngineResult } from "./scan-classifier";

// Deterministic tests — buildScanReport is pure over a set of results.
// canonicalizeDomain has clear input/output pairs. classifyAnswer is
// LLM-dependent and covered indirectly by the visibility-engine tests.

describe("canonicalizeDomain", () => {
  it("strips protocol, www and path", () => {
    expect(canonicalizeDomain("https://www.example.com/path?q=1")).toBe("example.com");
    expect(canonicalizeDomain("HTTP://Foo.co.in")).toBe("foo.co.in");
  });

  it("rejects invalid, localhost, and IP inputs", () => {
    expect(canonicalizeDomain("")).toBeNull();
    expect(canonicalizeDomain("localhost")).toBeNull();
    expect(canonicalizeDomain("localhost:3000")).toBeNull();
    expect(canonicalizeDomain("192.168.1.1")).toBeNull();
    expect(canonicalizeDomain("bare")).toBeNull();
    expect(canonicalizeDomain("no-tld/")).toBeNull();
  });

  it("strips trailing port when present", () => {
    expect(canonicalizeDomain("example.com:8080")).toBe("example.com");
  });
});

const RESULT = (opts: {
  engine: string;
  prompt: string;
  mentioned: boolean;
  competitors: { name: string; mentioned: boolean }[];
  sentiment?: "positive" | "neutral" | "negative";
  skipped?: boolean;
}): ScanEngineResult => ({
  engine: opts.engine,
  prompt: opts.prompt,
  content: opts.skipped ? "" : `sample answer body for ${opts.prompt}`,
  cited_urls: [],
  classified: opts.skipped
    ? null
    : {
        brand_mentioned: opts.mentioned,
        brand_position: null,
        sentiment: opts.sentiment ?? "neutral",
        cited_urls: [],
        competitor_mentions: opts.competitors.map((c) => ({ name: c.name, mentioned: c.mentioned, position: null })),
        recommendation_alignment: "neutral",
        mention_verification: {
          brand: { agreed: true, llmSaid: opts.mentioned, textMatchSaid: opts.mentioned },
          competitors: opts.competitors.map((c) => ({ name: c.name, agreed: true })),
          recommendation_alignment: "neutral",
        },
      },
  skipped: opts.skipped,
});

describe("buildScanReport", () => {
  it("computes score, per-engine breakdown, and competitor ranking", () => {
    const results: ScanEngineResult[] = [
      RESULT({ engine: "chatgpt", prompt: "p1", mentioned: true, competitors: [{ name: "Rival", mentioned: true }] }),
      RESULT({ engine: "chatgpt", prompt: "p2", mentioned: false, competitors: [{ name: "Rival", mentioned: true }] }),
      RESULT({ engine: "perplexity", prompt: "p1", mentioned: false, competitors: [{ name: "Rival", mentioned: true }] }),
      RESULT({ engine: "gemini", prompt: "p1", mentioned: false, competitors: [{ name: "Rival", mentioned: true }] }),
    ];
    const report = buildScanReport({
      brandName: "TestCo",
      domain: "test.co",
      competitorNames: ["Rival"],
      results,
    });
    expect(report.totalAnswers).toBe(4);
    expect(report.brandMentionedAnswers).toBe(1);
    expect(report.visibilityScore).toBe(25);
    expect(report.competitorScores[0].name).toBe("Rival");
    expect(report.competitorScores[0].mentioned).toBe(4);
    expect(report.perEngine.find((e) => e.engine === "chatgpt")?.rate).toBe(50);
    // Opportunities: prompts where brand is absent but competitors present.
    expect(report.opportunities.length).toBeGreaterThan(0);
    expect(report.opportunities.every((o) => o.competitors_present.includes("Rival"))).toBe(true);
  });

  it("skips skipped engines from denominators", () => {
    const results: ScanEngineResult[] = [
      RESULT({ engine: "chatgpt", prompt: "p1", mentioned: true, competitors: [] }),
      RESULT({ engine: "grok", prompt: "p1", mentioned: false, competitors: [], skipped: true }),
    ];
    const report = buildScanReport({
      brandName: "TestCo",
      domain: "test.co",
      competitorNames: [],
      results,
    });
    expect(report.totalAnswers).toBe(1);
    expect(report.visibilityScore).toBe(100);
  });

  it("returns zero visibility when nothing usable", () => {
    const results: ScanEngineResult[] = [
      RESULT({ engine: "chatgpt", prompt: "p1", mentioned: false, competitors: [], skipped: true }),
    ];
    const report = buildScanReport({
      brandName: "TestCo",
      domain: "test.co",
      competitorNames: [],
      results,
    });
    expect(report.totalAnswers).toBe(0);
    expect(report.visibilityScore).toBe(0);
  });
});
