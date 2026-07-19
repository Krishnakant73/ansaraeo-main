import { describe, it, expect } from "vitest";
import { scoreCompetitorThreat } from "./competitor-traits";

// ============================================================
// Deterministic threat scorer. Ranges chosen so the tests remain
// stable while the underlying weights can be tuned without
// touching the shape.
// ============================================================

describe("scoreCompetitorThreat", () => {
  it("returns 0 components and score 0 when no signal is provided", () => {
    const result = scoreCompetitorThreat({
      gapPp: null,
      citationShareDeltaPp: null,
      positionLead: null,
      contentVelocityRatio: null,
      forecastCrossoverIn: null,
    });
    expect(result.components).toEqual([]);
    expect(result.score).toBe(0);
  });

  it("scores neutral gap around the middle of the scale", () => {
    const result = scoreCompetitorThreat({
      gapPp: 10,
      citationShareDeltaPp: null,
      positionLead: null,
      contentVelocityRatio: null,
      forecastCrossoverIn: null,
    });
    // With only gapPp = 10 -> scaled to 50 -> single-component avg 50.
    expect(result.score).toBe(50);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].label).toBe("Mention-rate gap");
  });

  it("clamps extreme inputs to the [0, 100] range", () => {
    const low = scoreCompetitorThreat({
      gapPp: -100,
      citationShareDeltaPp: -100,
      positionLead: -10,
      contentVelocityRatio: -1,
      forecastCrossoverIn: 3650,
    });
    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(low.score).toBeLessThanOrEqual(100);

    const high = scoreCompetitorThreat({
      gapPp: 100,
      citationShareDeltaPp: 100,
      positionLead: 10,
      contentVelocityRatio: 20,
      forecastCrossoverIn: 0,
    });
    expect(high.score).toBeGreaterThanOrEqual(0);
    expect(high.score).toBeLessThanOrEqual(100);
    // Every signal maxed → score should be 100.
    expect(high.score).toBe(100);
  });

  it("weights mention-rate gap higher than content velocity", () => {
    const gapHeavy = scoreCompetitorThreat({
      gapPp: 40,
      citationShareDeltaPp: null,
      positionLead: null,
      contentVelocityRatio: null,
      forecastCrossoverIn: null,
    });
    const velocityHeavy = scoreCompetitorThreat({
      gapPp: null,
      citationShareDeltaPp: null,
      positionLead: null,
      contentVelocityRatio: 4,
      forecastCrossoverIn: null,
    });
    // Both single-component runs normalize to their contribution.
    expect(gapHeavy.components[0].weight).toBeGreaterThan(velocityHeavy.components[0].weight);
  });

  it("returns crossover imminence when forecast is inside 30 days", () => {
    const result = scoreCompetitorThreat({
      gapPp: null,
      citationShareDeltaPp: null,
      positionLead: null,
      contentVelocityRatio: null,
      forecastCrossoverIn: 15,
    });
    const crossoverComp = result.components.find((c) => c.label === "Forecast crossover risk");
    expect(crossoverComp).toBeDefined();
    expect(crossoverComp?.detail).toBe("imminent");
  });
});
