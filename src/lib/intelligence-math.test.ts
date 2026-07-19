import { describe, it, expect } from "vitest";
import {
  normalizeEntityKey,
  accumulateEdges,
  pageRank,
  degrees,
} from "./discovery-graph";
import {
  marketShareIndex,
  mindshare,
  rankDescending,
  percentileRank,
} from "./brand-rankings";
import {
  trendDirection,
  zScore,
  computeTrendCell,
} from "./benchmark-trends";
import {
  holtForecast,
  residualStd,
  etsForecast,
  MIN_HISTORY,
} from "./forecast-engine";
import {
  gapMagnitude,
  priorityScore,
  prioritizeOpportunities,
} from "./opportunity-engine";

describe("discovery-graph pure math", () => {
  it("normalizeEntityKey lowercases, strips punctuation, collapses spaces", () => {
    expect(normalizeEntityKey("  Acme, Inc. ")).toBe("acme inc");
    expect(normalizeEntityKey("SaaS-Tools")).toBe("saas tools");
  });

  it("accumulateEdges sums weights per directed pair and ignores self-loops", () => {
    const m = accumulateEdges([
      { from: "a", to: "b", weight: 1 },
      { from: "a", to: "b", weight: 2 },
      { from: "a", to: "a", weight: 5 },
    ]);
    expect(m.get("a")?.get("b")).toBeCloseTo(3, 5);
    expect(m.has("a") && m.get("a")?.has("a")).toBeFalsy();
  });

  it("pageRank returns non-negative scores summing to ~1", () => {
    const edges = [
      { from: "a", to: "b", weight: 1 },
      { from: "b", to: "c", weight: 1 },
      { from: "c", to: "a", weight: 1 },
    ];
    const pr = pageRank(["a", "b", "c"], edges);
    const total = [...pr.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 5);
    for (const v of pr.values()) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("pageRank gives a well-connected node higher rank (authority)", () => {
    // b and c both point to a → a is authoritative
    const edges = [
      { from: "b", to: "a", weight: 1 },
      { from: "c", to: "a", weight: 1 },
      { from: "a", to: "b", weight: 1 },
    ];
    const pr = pageRank([], edges);
    expect(pr.get("a")!).toBeGreaterThan(pr.get("c")!);
  });

  it("degrees counts in/out correctly", () => {
    const { inDegree, outDegree } = degrees([
      { from: "a", to: "b", weight: 1 },
      { from: "a", to: "c", weight: 1 },
      { from: "b", to: "a", weight: 1 },
    ]);
    expect(outDegree.get("a")).toBe(2);
    expect(inDegree.get("a")).toBe(1);
    expect(inDegree.get("b")).toBe(1);
  });
});

describe("brand-rankings pure math", () => {
  it("marketShareIndex nulls on missing input, smooths to avoid 100%", () => {
    expect(marketShareIndex(null, 10)).toBeNull();
    // smoothing=0 → no Laplace smoothing → 5 / (5 + 0) = 1 (single brand can be 100% only when caller opts out of smoothing)
    expect(marketShareIndex(5, 5, 0)).toBeCloseTo(1, 5);
    expect(marketShareIndex(5, 5, 1)).toBeCloseTo(5 / 6, 5); // smoothed
  });

  it("mindshare blends mentions and citations", () => {
    const m = mindshare(10, 4, 100, 40);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThanOrEqual(1);
  });

  it("rankDescending assigns 1 to the best, ties share rank", () => {
    const r = rankDescending([0.9, 0.5, 0.9, 0.2]);
    expect(r.get(0.9)).toBe(1);
    expect(r.get(0.5)).toBe(3);
    expect(r.get(0.2)).toBe(4);
  });

  it("percentileRank mid-rank method", () => {
    expect(percentileRank(5, [1, 2, 3, 4, 5])).toBeCloseTo(90, 5);
    expect(percentileRank(5, [5, 5, 5])).toBeCloseTo(50, 5);
  });
});

describe("benchmark-trends pure math", () => {
  it("trendDirection null→flat, tiny→flat, signs", () => {
    expect(trendDirection(null)).toBe("flat");
    expect(trendDirection(0.001)).toBe("flat");
    expect(trendDirection(0.1)).toBe("up");
    expect(trendDirection(-0.1)).toBe("down");
  });

  it("zScore null on <2 samples, 0 on zero variance", () => {
    expect(zScore(5, [1])).toBeNull();
    // zero-variance population: z-score is undefined (sd = 0). Defensive
    // contract returns 0 so callers never get NaN — whether the value equals
    // the mean (5) or differs from it (7), the population has no spread.
    expect(zScore(5, [5, 5, 5])).toBe(0);
    expect(zScore(7, [5, 5, 5])).toBe(0);
  });

  it("computeTrendCell: first month → null delta, no change point", () => {
    const c = computeTrendCell([0.4]);
    expect(c.delta).toBeNull();
    expect(c.change_point).toBe(false);
    expect(c.trend_direction).toBe("flat");
  });

  it("computeTrendCell flags a change point when latest is >2σ from prior window", () => {
    // Prior window has REAL variance so the z-score is well-defined; the
    // final point (0.9) is many σ above it → genuine change point.
    const series = [0.5, 0.52, 0.49, 0.51, 0.9];
    const c = computeTrendCell(series);
    expect(c.change_point).toBe(true);
    expect(c.delta).toBeCloseTo(0.39, 5);
    expect(c.trend_direction).toBe("up");
  });
});

describe("forecast-engine pure math", () => {
  it("holtForecast projects a linear trend forward", () => {
    const { forecast } = holtForecast([1, 2, 3, 4, 5], 3);
    expect(forecast.length).toBe(3);
    expect(forecast[0]).toBeGreaterThan(5); // trending up
    expect(forecast[2]).toBeGreaterThan(forecast[0]);
  });

  it("residualStd null on <2 residuals", () => {
    expect(residualStd([1])).toBeNull();
    expect(residualStd([0, 0, 0])).toBe(0);
  });

  it("etsForecast emits point + lower/upper bands and insufficient_history flag", () => {
    const short = etsForecast(
      [{ period: "2026-01-01", value: 0.4 }],
      6,
      { bounds: { min: 0, max: 1 } },
    );
    expect(short.insufficient_history).toBe(true);
    expect(short.confidence).toBe("low");
    expect(short.point.length).toBe(6);
    expect(short.lower.length).toBe(6);
    expect(short.upper.length).toBe(6);
    // bands enclose the point
    for (let i = 0; i < 6; i++) {
      expect(short.lower[i].value).toBeLessThanOrEqual(short.point[i].value);
      expect(short.upper[i].value).toBeGreaterThanOrEqual(short.point[i].value);
    }
  });

  it("etsForecast with enough history is high confidence and bands respect bounds", () => {
    const series = Array.from({ length: 12 }, (_, i) => ({ period: `2026-${String(i + 1).padStart(2, "0")}-01`, value: 0.3 + i * 0.01 }));
    const r = etsForecast(series, 3, { bounds: { min: 0, max: 1 } });
    expect(r.insufficient_history).toBe(false);
    expect(r.confidence).toBe("high");
    for (const p of [...r.point, ...r.lower, ...r.upper]) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(1);
    }
  });

  it("MIN_HISTORY is 6", () => {
    expect(MIN_HISTORY).toBe(6);
  });
});

describe("opportunity-engine pure math", () => {
  it("gapMagnitude is 0 at/above benchmark, positive below", () => {
    expect(gapMagnitude(0.5, 0.5)).toBe(0);
    expect(gapMagnitude(0.6, 0.5)).toBe(0);
    expect(gapMagnitude(0.3, 0.5)).toBeCloseTo(0.2, 5);
  });

  it("priorityScore scales with gap × log volume × weight, capped at 1", () => {
    const low = priorityScore(0.2, 10, 1);
    const high = priorityScore(0.2, 10000, 1);
    expect(high).toBeGreaterThan(low);
    expect(priorityScore(1, 1e9, 1)).toBeLessThanOrEqual(1);
  });

  it("prioritizeOpportunities sorts by priority desc and clamps", () => {
    const gaps = [
      { type: "citation_gap" as const, title: "a", detail: {}, estimated_impact: { mentions_per_month: 1, visibility_delta: 0.1 }, priority_score: 0.2 },
      { type: "position_gap" as const, title: "b", detail: {}, estimated_impact: { mentions_per_month: 1, visibility_delta: 0.1 }, priority_score: 0.9 },
    ];
    const sorted = prioritizeOpportunities(gaps);
    expect(sorted[0].type).toBe("position_gap");
    expect(sorted[0].priority_score).toBeLessThanOrEqual(1);
  });
});
