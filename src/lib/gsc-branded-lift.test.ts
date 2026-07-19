import { describe, it, expect } from "vitest";
import { computeBrandedLift } from "./gsc-branded-lift";

const rows = (brand: string, other: string) => [
  { query: brand, clicks: 10, impressions: 1000, ctr: 0.01, position: 2 },
  { query: other, clicks: 5, impressions: 500, ctr: 0.01, position: 5 },
];

describe("computeBrandedLift", () => {
  it("splits branded vs non-branded and computes lifts", () => {
    const baseline = rows("acme", "rival");
    const comparison = [
      { query: "acme", clicks: 20, impressions: 2000, ctr: 0.01, position: 1.5 },
      { query: "rival", clicks: 5, impressions: 500, ctr: 0.01, position: 5 },
    ];
    const lift = computeBrandedLift(baseline, comparison, "acme");
    expect(lift.branded.comparison.impressions).toBe(2000);
    expect(lift.branded.impressionsLiftPct).toBe(100); // 2000 vs 1000
    expect(lift.branded.clicksLiftPct).toBe(100); // 20 vs 10
    expect(lift.nonBranded.comparison.impressions).toBe(500);
    expect(lift.brandedImpressionSharePct).toBe(80); // 2000 / (2000 + 500)
    expect(lift.topBrandedQueries).toContain("acme");
  });

  it("matches brand name case-insensitively", () => {
    const lift = computeBrandedLift(rows("ACME", "rival"), rows("Acme", "rival"), "acme");
    expect(lift.branded.comparison.impressions).toBe(1000);
  });

  it("reports no lift when no brand name is provided", () => {
    const lift = computeBrandedLift(rows("acme", "rival"), rows("acme", "rival"), "");
    expect(lift.branded.impressionsLiftPct).toBeNull();
    expect(lift.topBrandedQueries).toEqual([]);
  });

  it("computes position delta (lower is better)", () => {
    const baseline = rows("acme", "rival"); // acme position 2
    const comparison = [{ query: "acme", clicks: 20, impressions: 2000, ctr: 0.01, position: 1.5 }, { query: "rival", clicks: 5, impressions: 500, ctr: 0.01, position: 5 }];
    const lift = computeBrandedLift(baseline, comparison, "acme");
    expect(lift.branded.positionDelta).toBe(-0.5); // improved
  });
});
