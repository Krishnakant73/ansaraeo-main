import { describe, it, expect } from "vitest";
import {
  detectMentionRateDrift,
  detectCitationShift,
} from "./engine-change-log";

// ============================================================
// Only the pure detectors have unit tests — the merged fetcher
// (detectEngineChanges) is thin plumbing over Supabase and gets
// exercised in build/typecheck instead.
// ============================================================

function mkDay(daysAgo: number, mention: number | null, own: number | null = null) {
  const d = new Date("2026-07-19T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return {
    captured_on: d.toISOString().slice(0, 10),
    mention_rate: mention,
    own_citation_share: own,
  };
}

describe("detectMentionRateDrift", () => {
  it("emits nothing when there is less than 21 days of data", () => {
    const days = Array.from({ length: 10 }, (_, i) => mkDay(19 - i, 50));
    const events = detectMentionRateDrift(days);
    expect(events).toEqual([]);
  });

  it("emits nothing on a flat series", () => {
    const days = Array.from({ length: 30 }, (_, i) => mkDay(29 - i, 40));
    const events = detectMentionRateDrift(days);
    expect(events).toEqual([]);
  });

  it("emits a positive drift when rate jumps ≥ 8pp above the prior 2 weeks", () => {
    const days = [
      ...Array.from({ length: 14 }, (_, i) => mkDay(29 - i, 40)),
      ...Array.from({ length: 7 }, (_, i) => mkDay(6 - i, 60)),
    ].sort((a, b) => (a.captured_on < b.captured_on ? -1 : 1));
    const events = detectMentionRateDrift(days);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].kind).toBe("baseline_drift");
    expect(events[0].magnitude! > 0).toBe(true);
    expect(events[0].summary).toMatch(/jumped/);
  });

  it("emits a negative drift when rate collapses ≥ 8pp below the prior baseline", () => {
    const days = [
      ...Array.from({ length: 14 }, (_, i) => mkDay(29 - i, 70)),
      ...Array.from({ length: 7 }, (_, i) => mkDay(6 - i, 45)),
    ].sort((a, b) => (a.captured_on < b.captured_on ? -1 : 1));
    const events = detectMentionRateDrift(days);
    expect(events.length).toBeGreaterThan(0);
    const first = events[0];
    expect(first.kind).toBe("baseline_drift");
    expect(first.magnitude! < 0).toBe(true);
    expect(first.summary).toMatch(/slid|slipp/);
  });
});

describe("detectCitationShift", () => {
  it("emits nothing when there is less than 14 days of citation data", () => {
    const days = Array.from({ length: 7 }, (_, i) => mkDay(6 - i, 40, 30));
    const events = detectCitationShift(days);
    expect(events).toEqual([]);
  });

  it("emits nothing on a flat citation series", () => {
    const days = Array.from({ length: 20 }, (_, i) => mkDay(19 - i, 40, 25));
    const events = detectCitationShift(days);
    expect(events).toEqual([]);
  });

  it("fires when own-citation share shifts ≥ 10pp week-over-week", () => {
    const days = [
      ...Array.from({ length: 7 }, (_, i) => mkDay(13 - i, 40, 20)),
      ...Array.from({ length: 7 }, (_, i) => mkDay(6 - i, 45, 40)),
    ].sort((a, b) => (a.captured_on < b.captured_on ? -1 : 1));
    const events = detectCitationShift(days);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].kind).toBe("citation_shift");
    expect(events[0].magnitude! > 0).toBe(true);
  });
});
