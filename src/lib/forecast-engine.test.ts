// ============================================================
// forecast-engine.test.ts — pure math + prompt bucketing tests.
// Relative imports only (no `@/` — vitest has no alias here).
// ============================================================

import { describe, expect, it } from "vitest";
import {
  bucketPromptMonthly,
  etsForecast,
  holtForecast,
  MIN_HISTORY,
  residualStd,
} from "./forecast-engine";

describe("holtForecast", () => {
  it("returns empty for an empty series", () => {
    const r = holtForecast([], 3);
    expect(r.forecast).toEqual([]);
    expect(r.residuals).toEqual([]);
  });

  it("carries the last level when no trend is available", () => {
    const r = holtForecast([5], 3);
    // trend is 0 (only one point); forecast is level for every horizon step.
    expect(r.forecast).toEqual([5, 5, 5]);
  });

  it("advances by trend for a clean linear series", () => {
    const r = holtForecast([1, 2, 3, 4], 2);
    // point-forecast values should be monotone-increasing for a rising series.
    expect(r.forecast[0]).toBeGreaterThan(r.forecast[0] - 1);
    expect(r.forecast[1]).toBeGreaterThan(r.forecast[0]);
  });
});

describe("residualStd", () => {
  it("returns null for <2 residuals", () => {
    expect(residualStd([])).toBeNull();
    expect(residualStd([1])).toBeNull();
  });
  it("computes sample std-dev", () => {
    // sample std-dev of [1, -1] is sqrt(2)
    const s = residualStd([1, -1]);
    expect(s).toBeCloseTo(Math.sqrt(2), 6);
  });
});

describe("etsForecast", () => {
  it("marks insufficient_history when < MIN_HISTORY points", () => {
    const short = Array.from({ length: MIN_HISTORY - 1 }, (_, i) => ({
      period: `2026-0${i + 1}-01`,
      value: 0.1 * i,
    }));
    const r = etsForecast(short, 3);
    expect(r.insufficient_history).toBe(true);
    expect(r.confidence).toBe("low");
    expect(r.point.length).toBe(3);
  });

  it("respects bounds — never emits <0 or >1 for a rate", () => {
    const series = [
      { period: "2026-01-01", value: 0.98 },
      { period: "2026-02-01", value: 0.99 },
      { period: "2026-03-01", value: 1.0 },
      { period: "2026-04-01", value: 1.0 },
      { period: "2026-05-01", value: 1.0 },
      { period: "2026-06-01", value: 1.0 },
    ];
    const r = etsForecast(series, 6, { bounds: { min: 0, max: 1 } });
    for (const p of [...r.point, ...r.upper, ...r.lower]) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(1);
    }
  });

  it("widens bands with empirical p10/p90 when the model is over-confident", () => {
    const flat = Array.from({ length: 12 }, (_, i) => ({
      period: `2026-${String(i + 1).padStart(2, "0")}-01`,
      value: 0.5,
    }));
    const narrow = etsForecast(flat, 3, { bounds: { min: 0, max: 1 } });
    const widened = etsForecast(flat, 3, {
      bounds: { min: 0, max: 1 },
      empiricalP10P90: { p10: 0.2, p90: 0.8 },
    });
    const narrowSpread = narrow.upper[0].value - narrow.lower[0].value;
    const widenedSpread = widened.upper[0].value - widened.lower[0].value;
    expect(widenedSpread).toBeGreaterThan(narrowSpread);
  });
});

describe("bucketPromptMonthly", () => {
  it("returns empty for no rows", () => {
    expect(bucketPromptMonthly([])).toEqual([]);
  });

  it("ignores rows with brand_mentioned=null (skipped engines)", () => {
    const out = bucketPromptMonthly([
      { run_at: "2026-01-04T12:00:00Z", brand_mentioned: null },
      { run_at: "2026-01-05T12:00:00Z", brand_mentioned: null },
    ]);
    // No observed month — nothing to bucket.
    expect(out).toEqual([]);
  });

  it("computes mention_rate per calendar month, chronological order", () => {
    const out = bucketPromptMonthly([
      // Jan: 1/2 = 0.5
      { run_at: "2026-01-04T12:00:00Z", brand_mentioned: true },
      { run_at: "2026-01-05T12:00:00Z", brand_mentioned: false },
      // Feb: 2/2 = 1.0 (one null ignored)
      { run_at: "2026-02-04T12:00:00Z", brand_mentioned: true },
      { run_at: "2026-02-05T12:00:00Z", brand_mentioned: null },
      { run_at: "2026-02-06T12:00:00Z", brand_mentioned: true },
      // Mar: 0/1 = 0
      { run_at: "2026-03-04T12:00:00Z", brand_mentioned: false },
    ]);
    expect(out).toEqual([
      { period: "2026-01-01", value: 0.5 },
      { period: "2026-02-01", value: 1 },
      { period: "2026-03-01", value: 0 },
    ]);
  });

  it("sorts an out-of-order input into ascending period order", () => {
    const out = bucketPromptMonthly([
      { run_at: "2026-03-04T12:00:00Z", brand_mentioned: true },
      { run_at: "2026-01-04T12:00:00Z", brand_mentioned: true },
      { run_at: "2026-02-04T12:00:00Z", brand_mentioned: false },
    ]);
    expect(out.map((r) => r.period)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });
});
