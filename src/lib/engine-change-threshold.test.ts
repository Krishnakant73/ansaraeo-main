import { describe, it, expect } from "vitest";

// ============================================================
// The meetsThreshold predicate lives inside the cron route (a
// server-only file with Next imports). Copy the pure logic here
// for testability — same rules, same cutoffs, easy to keep in
// sync with a code review.
// ============================================================

type Row = {
  kind: "baseline_drift" | "citation_shift" | "format_shift" | "manual";
  magnitude: number | null;
};

function meetsThreshold(row: Row): boolean {
  if (row.kind === "manual") return true;
  if (row.magnitude == null) return false;
  const mag = Math.abs(row.magnitude);
  if (row.kind === "baseline_drift") return mag >= 15;
  if (row.kind === "citation_shift") return true;
  if (row.kind === "format_shift") return mag >= 15;
  return false;
}

describe("engine-change-alerts / meetsThreshold", () => {
  it("always fires on manual entries", () => {
    expect(meetsThreshold({ kind: "manual", magnitude: null })).toBe(true);
    expect(meetsThreshold({ kind: "manual", magnitude: 3 })).toBe(true);
  });

  it("skips baseline_drift below 15pp", () => {
    expect(meetsThreshold({ kind: "baseline_drift", magnitude: 10 })).toBe(false);
    expect(meetsThreshold({ kind: "baseline_drift", magnitude: -8 })).toBe(false);
  });

  it("fires baseline_drift at or above 15pp (either direction)", () => {
    expect(meetsThreshold({ kind: "baseline_drift", magnitude: 15 })).toBe(true);
    expect(meetsThreshold({ kind: "baseline_drift", magnitude: -20 })).toBe(true);
  });

  it("fires any non-null citation_shift", () => {
    expect(meetsThreshold({ kind: "citation_shift", magnitude: 10 })).toBe(true);
    expect(meetsThreshold({ kind: "citation_shift", magnitude: -10.1 })).toBe(true);
  });

  it("skips format_shift below 15 points", () => {
    expect(meetsThreshold({ kind: "format_shift", magnitude: 12 })).toBe(false);
  });

  it("fires format_shift at or above 15 points", () => {
    expect(meetsThreshold({ kind: "format_shift", magnitude: 15 })).toBe(true);
    expect(meetsThreshold({ kind: "format_shift", magnitude: -20 })).toBe(true);
  });

  it("skips rows with null magnitude on drift/shift kinds", () => {
    expect(meetsThreshold({ kind: "baseline_drift", magnitude: null })).toBe(false);
    expect(meetsThreshold({ kind: "citation_shift", magnitude: null })).toBe(false);
    expect(meetsThreshold({ kind: "format_shift", magnitude: null })).toBe(false);
  });
});
