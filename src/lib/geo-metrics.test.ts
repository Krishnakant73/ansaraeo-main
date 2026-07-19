import { describe, it, expect } from "vitest";
import { computeGeoMetrics, splitWindows, type GeoRun, type GeoCitation, type EngineInfo } from "./geo-metrics";

const engines: EngineInfo[] = [
  { id: "e1", name: "chatgpt" },
  { id: "e2", name: "perplexity" },
];

// 4 runs across 2 engines; 3 mentioned.
const runs: GeoRun[] = [
  { id: "r1", prompt_id: "p1", engine_id: "e1", run_at: "2026-07-10T10:00:00Z", brand_mentioned: true, brand_position: 1, sentiment: "positive", recommendation_alignment: "aligned" },
  { id: "r2", prompt_id: "p1", engine_id: "e1", run_at: "2026-07-10T11:00:00Z", brand_mentioned: true, brand_position: 3, sentiment: "positive", recommendation_alignment: "aligned" },
  { id: "r3", prompt_id: "p2", engine_id: "e2", run_at: "2026-07-10T12:00:00Z", brand_mentioned: false, brand_position: null, sentiment: "negative", recommendation_alignment: "neutral" },
  { id: "r4", prompt_id: "p1", engine_id: "e2", run_at: "2026-07-10T13:00:00Z", brand_mentioned: true, brand_position: 2, sentiment: "positive", recommendation_alignment: "misaligned" },
];

const citations: GeoCitation[] = [
  { id: "c1", run_id: "r1", cited_domain: "mybrand.com", cited_url: "https://mybrand.com", is_own_domain: true, is_competitor_domain: false, is_trusted_source: false },
  { id: "c2", run_id: "r2", cited_domain: "mybrand.com", cited_url: "https://mybrand.com", is_own_domain: true, is_competitor_domain: false, is_trusted_source: false },
  { id: "c3", run_id: "r4", cited_domain: "rival.com", cited_url: "https://rival.com", is_own_domain: false, is_competitor_domain: true, is_trusted_source: false },
  { id: "c4", run_id: "r4", cited_domain: "wikipedia.org", cited_url: "https://wikipedia.org", is_own_domain: false, is_competitor_domain: false, is_trusted_source: true },
];

const promptIntent: Record<string, any> = { p1: "awareness", p2: "comparison" };

describe("computeGeoMetrics", () => {
  it("computes the core visibility/citation metrics", () => {
    const m = computeGeoMetrics({ runs, citations, engines, promptIntent });
    expect(m.visibility_rate).toBe(75); // 3/4
    expect(m.citation_rate).toBe(50); // r1 + r2 cited / 4
    expect(m.citation_share).toBe(50); // 2 own / 4 total
    expect(m.avg_rank).toBe(2); // (1+3+2)/3
    expect(m.recommendation_quality).toBe(67); // 2 aligned / 3 mentioned
  });

  it("computes sentiment score from pos/neu/neg (0-100)", () => {
    const m = computeGeoMetrics({ runs, citations, engines, promptIntent });
    // +1 +1 -1 +1 = 1 -> (1/4 + 1) * 50 = 75
    expect(m.sentiment_score).toBe(75);
  });

  it("computes model divergence as std-dev of per-engine visibility rates", () => {
    const m = computeGeoMetrics({ runs, citations, engines, promptIntent });
    // chatgpt 100%, perplexity 50% -> stddev 25
    expect(m.model_divergence).toBe(25);
    expect(m.per_engine.chatgpt.visibility_rate).toBe(100);
    expect(m.per_engine.perplexity.visibility_rate).toBe(50);
    expect(m.per_engine.perplexity.citation_share).toBe(0); // 0 own / 2 cites
  });

  it("buckets by intent", () => {
    const m = computeGeoMetrics({ runs, citations, engines, promptIntent });
    expect(m.by_intent.awareness.visibility_rate).toBe(100); // p1: 3/3
    expect(m.by_intent.awareness.citation_rate).toBe(67); // 2 cited / 3
    expect(m.by_intent.comparison.visibility_rate).toBe(0); // p2 not mentioned
  });

  it("derives trend velocity from a prior window", () => {
    const prior: GeoRun[] = [
      { id: "pr1", prompt_id: "p1", engine_id: "e1", run_at: "2026-07-01T10:00:00Z", brand_mentioned: true, brand_position: 1, sentiment: "positive", recommendation_alignment: "aligned" },
    ];
    const m = computeGeoMetrics({ runs, citations, engines, promptIntent, priorRuns: prior });
    // current 75 - prior 100 = -25
    expect(m.trend_velocity).toBe(-25);
  });

  it("returns nulls when there are no runs", () => {
    const m = computeGeoMetrics({ runs: [], citations: [], engines, promptIntent });
    expect(m.visibility_rate).toBeNull();
    expect(m.citation_share).toBeNull();
    expect(m.model_divergence).toBeNull();
    expect(m.trend_velocity).toBeNull();
  });
});

describe("splitWindows", () => {
  it("splits runs into adjacent current/prior windows", () => {
    const now = new Date("2026-07-10T00:00:00Z").getTime();
    const all: GeoRun[] = [
      { id: "a", prompt_id: "p1", engine_id: "e1", run_at: new Date(now - 2 * 86_400_000).toISOString(), brand_mentioned: true, brand_position: 1, sentiment: "neutral", recommendation_alignment: "neutral" },
      { id: "b", prompt_id: "p1", engine_id: "e1", run_at: new Date(now - 5 * 86_400_000).toISOString(), brand_mentioned: true, brand_position: 1, sentiment: "neutral", recommendation_alignment: "neutral" },
      { id: "c", prompt_id: "p1", engine_id: "e1", run_at: new Date(now - 12 * 86_400_000).toISOString(), brand_mentioned: true, brand_position: 1, sentiment: "neutral", recommendation_alignment: "neutral" },
    ];
    const { current, prior } = splitWindows(all, 7, now);
    expect(current.map((r) => r.id).sort()).toEqual(["a", "b"]); // within 7d
    expect(prior.map((r) => r.id)).toEqual(["c"]); // 7-14d ago
  });
});
