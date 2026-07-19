import { describe, it, expect } from "vitest";
import {
  computeFirstMentionByEngine,
  computeCompetitorMovers,
  computePromptImprovements,
  overallRate,
  diffTrendWindows,
  type TrendPoint,
  type CompetitorTrend,
} from "./history-events";

describe("computeFirstMentionByEngine", () => {
  it("returns the first chronological mention per engine, excluding skips and non-mentions", () => {
    const rows = [
      { observed_at: "2026-03-01T00:00:00.000Z", engine_name: "chatgpt", skipped: false, brand_mentioned: true },
      { observed_at: "2026-01-01T00:00:00.000Z", engine_name: "gemini", skipped: false, brand_mentioned: true },
      // earlier chatgpt non-mention must NOT register a first mention
      { observed_at: "2026-02-01T00:00:00.000Z", engine_name: "chatgpt", skipped: false, brand_mentioned: false },
      // a skip is never a first mention
      { observed_at: "2026-04-01T00:00:00.000Z", engine_name: "perplexity", skipped: true, brand_mentioned: null },
    ];
    const out = computeFirstMentionByEngine(rows);
    expect(out).toEqual([
      { engine: "gemini", observed_at: "2026-01-01T00:00:00.000Z" },
      { engine: "chatgpt", observed_at: "2026-03-01T00:00:00.000Z" },
    ]);
  });

  it("handles unsorted input and returns engines in first-seen order", () => {
    const rows = [
      { observed_at: "2026-05-01T00:00:00.000Z", engine_name: "b", skipped: false, brand_mentioned: true },
      { observed_at: "2026-01-01T00:00:00.000Z", engine_name: "a", skipped: false, brand_mentioned: true },
    ];
    expect(computeFirstMentionByEngine(rows).map((f) => f.engine)).toEqual(["a", "b"]);
  });
});

describe("computeCompetitorMovers", () => {
  const trend: CompetitorTrend = {
    Rival: [
      { month: "2026-01-01", mentioned: 1, total: 4 }, // 25%
      { month: "2026-02-01", mentioned: 3, total: 4 }, // 75% -> +50pp gaining
    ],
    Loser: [
      { month: "2026-01-01", mentioned: 3, total: 4 }, // 75%
      { month: "2026-02-01", mentioned: 1, total: 4 }, // 25% -> -50pp losing
    ],
    Flat: [
      { month: "2026-01-01", mentioned: 2, total: 4 }, // 50%
      { month: "2026-02-01", mentioned: 2, total: 4 }, // 50% -> stable
    ],
  };

  it("classifies gaining / losing / stable with the ±5pp threshold", () => {
    const movers = computeCompetitorMovers(trend);
    const byName = Object.fromEntries(movers.map((m) => [m.name, m]));
    expect(byName.Rival).toMatchObject({ delta: 50, trend: "gaining" });
    expect(byName.Loser).toMatchObject({ delta: -50, trend: "losing" });
    expect(byName.Flat).toMatchObject({ delta: 0, trend: "stable" });
  });

  it("returns an empty list for an empty trend", () => {
    expect(computeCompetitorMovers({})).toEqual([]);
  });

  it("treats a competitor with no prior bucket as stable (no fabricated delta)", () => {
    const t: CompetitorTrend = { New: [{ month: "2026-02-01", mentioned: 2, total: 4 }] };
    expect(computeCompetitorMovers(t)[0]).toMatchObject({ delta: 0, trend: "stable" });
  });
});

describe("computePromptImprovements", () => {
  // toDate = 2026-06-01 -> recent window starts 2026-05-02.
  const toDate = new Date("2026-06-01T00:00:00.000Z");

  it("computes recent-vs-prior delta and sorts descending", () => {
    const rows = [
      { observed_at: "2026-05-20T00:00:00.000Z", prompt_id: "p1", prompt_text: "P1", skipped: false, brand_mentioned: true }, // recent
      { observed_at: "2026-04-10T00:00:00.000Z", prompt_id: "p1", prompt_text: "P1", skipped: false, brand_mentioned: false }, // prior
      { observed_at: "2026-05-15T00:00:00.000Z", prompt_id: "p2", prompt_text: "P2", skipped: false, brand_mentioned: true }, // recent
      { observed_at: "2026-04-05T00:00:00.000Z", prompt_id: "p2", prompt_text: "P2", skipped: false, brand_mentioned: true }, // prior
    ];
    const out = computePromptImprovements(rows, toDate);
    expect(out[0]).toMatchObject({ prompt_id: "p1", recentRate: 100, priorRate: 0, delta: 100 });
    expect(out[1]).toMatchObject({ prompt_id: "p2", recentRate: 100, priorRate: 100, delta: 0 });
  });

  it("excludes a prompt with data in only one window (delta=null)", () => {
    const rows = [
      { observed_at: "2026-04-10T00:00:00.000Z", prompt_id: "onlyPrior", prompt_text: "X", skipped: false, brand_mentioned: true },
    ];
    expect(computePromptImprovements(rows, toDate)).toEqual([]);
  });

  it("ignores skipped and null-mention rows", () => {
    const rows = [
      { observed_at: "2026-05-20T00:00:00.000Z", prompt_id: "p", prompt_text: "P", skipped: true, brand_mentioned: null },
      { observed_at: "2026-04-10T00:00:00.000Z", prompt_id: "p", prompt_text: "P", skipped: false, brand_mentioned: null },
    ];
    expect(computePromptImprovements(rows, toDate)).toEqual([]);
  });
});

describe("overallRate", () => {
  it("returns null when there are no qualifying runs", () => {
    expect(overallRate([])).toBeNull();
    expect(overallRate([{ bucket: "x", total: 0, mentioned: 0, rate: null }])).toBeNull();
  });

  it("aggregates mention rate across buckets, rounded to whole percent", () => {
    const pts: TrendPoint[] = [
      { bucket: "2026-01-01", total: 2, mentioned: 1, rate: 50 },
      { bucket: "2026-02-01", total: 2, mentioned: 1, rate: 50 },
    ];
    expect(overallRate(pts)).toBe(50);
  });
});

describe("diffTrendWindows", () => {
  const a: TrendPoint[] = [{ bucket: "2026-01-01", total: 4, mentioned: 1, rate: 25 }];
  const b: TrendPoint[] = [{ bucket: "2026-02-01", total: 4, mentioned: 3, rate: 75 }];

  it("returns before/after/delta in percentage points", () => {
    expect(diffTrendWindows(a, b)).toEqual({ before: 25, after: 75, delta: 50 });
  });

  it("returns delta=null when either window is empty (never fabricates)", () => {
    expect(diffTrendWindows([], b)).toEqual({ before: null, after: 75, delta: null });
    expect(diffTrendWindows(a, [])).toEqual({ before: 25, after: null, delta: null });
  });
});
