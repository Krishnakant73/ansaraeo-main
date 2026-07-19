import { describe, it, expect } from "vitest";
import {
  evaluate,
  computeConfidence,
  confidenceLevel,
  isRequirementMet,
  emptyMetrics,
} from "./service";
import { getModuleConfig } from "./requirements";
import type { ReadinessMetrics } from "./types";

const bench = getModuleConfig("benchmark"); // days>=30, obs>=1000, brands>=5, prompts>=20; target 10000; high 85
const forecast = getModuleConfig("forecast"); // trendLength>=6, obs>=30, days>=60, prompts>=3; high 85

function m(overrides: Partial<ReadinessMetrics>): ReadinessMetrics {
  return { ...emptyMetrics(), ...overrides };
}

describe("evaluate — state machine", () => {
  it("returns COLLECTING when there are zero observations", () => {
    const state = evaluate(bench, m({}));
    expect(state.status).toBe("COLLECTING");
    expect(state.justActivated).toBe(false);
    expect(state.percentage).toBe(0);
  });

  it("returns BUILDING when observations exist but no thresholds are met", () => {
    const state = evaluate(bench, m({ observations: 200, daysCollected: 5, brands: 1, prompts: 5 }));
    expect(state.status).toBe("BUILDING");
    expect(state.requirements.filter((r) => r.met)).toHaveLength(0);
  });

  it("returns PARTIAL when >=50% of thresholds are met but not all", () => {
    const state = evaluate(bench, m({ observations: 500, daysCollected: 10, brands: 10, prompts: 30 }));
    // brands + prompts met (2/4 => 50%), days + observations unmet
    expect(state.status).toBe("PARTIAL");
    expect(state.requirements.filter((r) => r.met)).toHaveLength(2);
  });

  it("returns READY when all thresholds met but confidence below the high bar", () => {
    const state = evaluate(bench, m({ observations: 2000, daysCollected: 40, brands: 10, prompts: 30 }));
    expect(state.status).toBe("READY");
    expect(state.justActivated).toBe(true);
  });

  it("returns HIGH_CONFIDENCE when all thresholds met AND confidence >= high bar", () => {
    const state = evaluate(bench, m({ observations: 10000, daysCollected: 60, brands: 20, prompts: 50, trendStability: 0.9 }));
    expect(state.status).toBe("HIGH_CONFIDENCE");
    expect(state.confidence).toBeGreaterThanOrEqual(bench.highConfidenceThreshold);
    expect(state.justActivated).toBe(true);
  });

  it("hides the card signal (justActivated) only for READY/HIGH_CONFIDENCE", () => {
    const collecting = evaluate(bench, m({}));
    const building = evaluate(bench, m({ observations: 100, daysCollected: 2, brands: 1, prompts: 1 }));
    expect(collecting.justActivated).toBe(false);
    expect(building.justActivated).toBe(false);
  });
});

describe("evaluate — forecast cohort", () => {
  it("stays BUILDING until the 6-month trend length threshold is reached", () => {
    const early = evaluate(forecast, m({ observations: 100, daysCollected: 30, trendLength: 3, prompts: 5 }));
    expect(early.status).not.toBe("READY");
    const ready = evaluate(forecast, m({ observations: 500, daysCollected: 80, trendLength: 8, prompts: 10 }));
    expect(ready.status).toBe("READY");
  });
});

describe("computeConfidence", () => {
  it("rises monotonically with observation volume", () => {
    const low = computeConfidence(m({ observations: 100 }), bench);
    const high = computeConfidence(m({ observations: 100_000 }), bench);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });

  it("rewards a stable trend", () => {
    const jittery = computeConfidence(m({ observations: 5000, trendStability: 0.1 }), bench);
    const stable = computeConfidence(m({ observations: 5000, trendStability: 0.95 }), bench);
    expect(stable).toBeGreaterThan(jittery);
  });
});

describe("helpers", () => {
  it("isRequirementMet compares against target", () => {
    expect(isRequirementMet(m({ observations: 50 }), bench.requirements[1])).toBe(false);
    expect(isRequirementMet(m({ observations: 1500 }), bench.requirements[1])).toBe(true);
  });

  it("confidenceLevel buckets 0..100", () => {
    expect(confidenceLevel(10)).toBe("Low");
    expect(confidenceLevel(50)).toBe("Medium");
    expect(confidenceLevel(90)).toBe("High");
  });

  it("emptyMetrics yields a zeroed signal (trendStability neutral at 0.5)", () => {
    const e = emptyMetrics();
    const { trendStability, ...rest } = e;
    expect(Object.values(rest).every((v) => v === 0)).toBe(true);
    expect(trendStability).toBe(0.5);
  });
});
