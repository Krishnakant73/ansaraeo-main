import { describe, it, expect } from "vitest";
import {
  mean,
  stddev,
  percentile,
  min,
  max,
  recommendationRate,
  citationRate,
  growth,
  growthPct,
  positionScore,
  trustScore,
  visibilityScore,
  bucketMonth,
} from "./benchmark-metrics";

describe("basic stats", () => {
  it("mean returns null on empty, correct average otherwise", () => {
    expect(mean([])).toBeNull();
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([0.5, 0.5])).toBe(0.5);
  });

  it("stddev returns null on empty, 0 on single, sample stdev otherwise", () => {
    expect(stddev([])).toBeNull();
    expect(stddev([5])).toBe(0);
    // sample stddev of [2,4,6,8] => sqrt(20/3) ≈ 2.5819
    expect(stddev([2, 4, 6, 8]) as number).toBeCloseTo(2.5819, 3);
  });

  it("percentile handles empty, single, and interpolated cases", () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([7], 90)).toBe(7);
    // sorted [1..10], p50 of R-7 => 5.5, p10 => 1.9, p90 => 9.1
    const v = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(percentile(v, 50) as number).toBeCloseTo(5.5, 5);
    expect(percentile(v, 10) as number).toBeCloseTo(1.9, 5);
    expect(percentile(v, 90) as number).toBeCloseTo(9.1, 5);
    expect(percentile(v, 0) as number).toBe(1);
    expect(percentile(v, 100) as number).toBe(10);
  });

  it("min/max handle empty", () => {
    expect(min([])).toBeNull();
    expect(max([])).toBeNull();
    expect(min([3, 1, 2])).toBe(1);
    expect(max([3, 1, 2])).toBe(3);
  });
});

describe("rates", () => {
  it("recommendationRate / citationRate null on zero total, else ratio", () => {
    expect(recommendationRate(0, 0)).toBeNull();
    expect(recommendationRate(3, 10)).toBeCloseTo(0.3, 5);
    expect(citationRate(0, 10)).toBe(0);
  });
});

describe("growth", () => {
  it("returns delta in points, null when either side missing", () => {
    expect(growth(null, 0.5)).toBeNull();
    expect(growth(0.6, 0.5)).toBeCloseTo(0.1, 5);
    expect(growthPct(0.6, 0.5) as number).toBeCloseTo(0.2, 5);
    expect(growthPct(0.5, 0)).toBeNull();
  });
});

describe("per-observation scores", () => {
  it("positionScore: unmentioned 0, rank1 1, decays to 0 by rank11", () => {
    expect(positionScore(false, 1)).toBe(0);
    expect(positionScore(true, 1)).toBe(1);
    expect(positionScore(true, 2)).toBeCloseTo(0.9, 5);
    expect(positionScore(true, 11)).toBe(0);
    expect(positionScore(true, null)).toBe(1);
  });

  it("trustScore bounds 0..1", () => {
    // unmentioned => 0
    expect(trustScore({ brand_mentioned: false, brand_position: 1, sentiment: "positive", recommendation_alignment: "aligned", has_own_citation: true })).toBe(0);
    // mentioned + positive + aligned => 1.0
    expect(trustScore({ brand_mentioned: true, brand_position: 1, sentiment: "positive", recommendation_alignment: "aligned", has_own_citation: true })).toBeCloseTo(1, 5);
    // mentioned + neutral + neutral => 0.7
    expect(trustScore({ brand_mentioned: true, brand_position: 3, sentiment: "neutral", recommendation_alignment: "neutral", has_own_citation: false })).toBeCloseTo(0.7, 5);
    // mentioned + negative + misaligned => 0.4
    expect(trustScore({ brand_mentioned: true, brand_position: 5, sentiment: "negative", recommendation_alignment: "misaligned", has_own_citation: false })).toBeCloseTo(0.4, 5);
    // unknown sentiment/alignment default neutral
    expect(trustScore({ brand_mentioned: true, brand_position: 2, sentiment: null, recommendation_alignment: null, has_own_citation: false })).toBeCloseTo(0.7, 5);
  });

  it("visibilityScore: unmentioned 0, else 0.6 + 0.4*positionScore", () => {
    expect(visibilityScore({ brand_mentioned: false, brand_position: 1, sentiment: null, recommendation_alignment: null, has_own_citation: false })).toBe(0);
    expect(visibilityScore({ brand_mentioned: true, brand_position: 1, sentiment: null, recommendation_alignment: null, has_own_citation: false })).toBeCloseTo(1, 5);
    expect(visibilityScore({ brand_mentioned: true, brand_position: 2, sentiment: null, recommendation_alignment: null, has_own_citation: false })).toBeCloseTo(0.96, 5);
  });
});

describe("bucketMonth", () => {
  it("returns first of month as YYYY-MM-DD", () => {
    expect(bucketMonth(new Date("2026-07-14T10:00:00Z"))).toBe("2026-07-01");
    expect(bucketMonth("2026-12-25T00:00:00Z")).toBe("2026-12-01");
  });
});
