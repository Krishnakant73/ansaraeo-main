import { describe, it, expect } from "vitest";
import {
  diffObservation,
  bucketTrend,
  bucketCompetitorTrend,
  computeRetentionCutoff,
  isRetentionTier,
  normalizeResponse,
  bucketKey,
  EVENT_TYPES,
  type DiffObservation,
} from "./history-events";

function obs(p: Partial<DiffObservation>): DiffObservation {
  return {
    id: "o1",
    observed_at: "2026-01-15T00:00:00.000Z",
    skipped: false,
    brand_mentioned: null,
    brand_position: null,
    sentiment: null,
    recommendation_alignment: null,
    competitor_mentions: null,
    ...p,
  };
}

describe("diffObservation", () => {
  it("emits first_mention when brand first appears", () => {
    const events = diffObservation({ prev: null, curr: obs({ brand_mentioned: true }) });
    expect(events.map((e) => e.event_type)).toContain(EVENT_TYPES.FIRST_MENTION);
  });

  it("does NOT emit first_mention when first observation is not mentioned", () => {
    const events = diffObservation({ prev: null, curr: obs({ brand_mentioned: false }) });
    expect(events.find((e) => e.event_type === EVENT_TYPES.FIRST_MENTION)).toBeUndefined();
  });

  it("emits mention_gained on false→true", () => {
    const events = diffObservation({
      prev: obs({ brand_mentioned: false }),
      curr: obs({ brand_mentioned: true }),
    });
    expect(events[0].event_type).toBe(EVENT_TYPES.MENTION_GAINED);
    expect(events[0].severity).toBe("positive");
  });

  it("emits mention_lost on true→false with negative severity", () => {
    const events = diffObservation({
      prev: obs({ brand_mentioned: true }),
      curr: obs({ brand_mentioned: false }),
    });
    expect(events[0].event_type).toBe(EVENT_TYPES.MENTION_LOST);
    expect(events[0].severity).toBe("negative");
  });

  it("emits recommendation_gained/lost around aligned state", () => {
    const gained = diffObservation({
      prev: obs({ recommendation_alignment: "neutral" }),
      curr: obs({ recommendation_alignment: "aligned" }),
    });
    expect(gained[0].event_type).toBe(EVENT_TYPES.RECOMMENDATION_GAINED);

    const lost = diffObservation({
      prev: obs({ recommendation_alignment: "aligned" }),
      curr: obs({ recommendation_alignment: "misaligned" }),
    });
    expect(lost[0].event_type).toBe(EVENT_TYPES.RECOMMENDATION_LOST);
  });

  it("emits position_improved when rank number drops", () => {
    const events = diffObservation({
      prev: obs({ brand_position: 5 }),
      curr: obs({ brand_position: 2 }),
    });
    expect(events[0].event_type).toBe(EVENT_TYPES.POSITION_IMPROVED);
    expect(events[0].detail).toMatchObject({ from: 5, to: 2 });
  });

  it("emits position_dropped when rank number rises", () => {
    const events = diffObservation({
      prev: obs({ brand_position: 2 }),
      curr: obs({ brand_position: 9 }),
    });
    expect(events[0].event_type).toBe(EVENT_TYPES.POSITION_DROPPED);
  });

  it("emits sentiment_shifted with directional severity", () => {
    const up = diffObservation({
      prev: obs({ sentiment: "negative" }),
      curr: obs({ sentiment: "positive" }),
    });
    expect(up[0].event_type).toBe(EVENT_TYPES.SENTIMENT_SHIFTED);
    expect(up[0].severity).toBe("positive");

    const down = diffObservation({
      prev: obs({ sentiment: "positive" }),
      curr: obs({ sentiment: "negative" }),
    });
    expect(down[0].severity).toBe("negative");
  });

  it("emits citation_gained and citation_lost via set diff", () => {
    const events = diffObservation({
      prev: obs({}),
      curr: obs({}),
      prevCitations: ["a.com", "b.com"],
      currCitations: ["b.com", "c.com"],
    });
    const gained = events.find((e) => e.event_type === EVENT_TYPES.CITATION_GAINED);
    const lost = events.find((e) => e.event_type === EVENT_TYPES.CITATION_LOST);
    expect(gained?.detail.domains).toEqual(["c.com"]);
    expect(lost?.detail.domains).toEqual(["a.com"]);
  });

  it("emits competitor_gained (negative) and competitor_lost (positive)", () => {
    const events = diffObservation({
      prev: obs({ competitor_mentions: [{ name: "Rival", mentioned: true, position: 1 }] }),
      curr: obs({ competitor_mentions: [{ name: "Rival", mentioned: false, position: null }] }),
    });
    const lost = events.find((e) => e.event_type === EVENT_TYPES.COMPETITOR_LOST);
    const gained = events.find((e) => e.event_type === EVENT_TYPES.COMPETITOR_GAINED);
    expect(lost).toBeDefined();
    expect(lost?.severity).toBe("positive");
    expect(gained).toBeUndefined();

    const events2 = diffObservation({
      prev: obs({ competitor_mentions: [{ name: "Rival", mentioned: false, position: null }] }),
      curr: obs({ competitor_mentions: [{ name: "Rival", mentioned: true, position: 1 }] }),
    });
    expect(events2.find((e) => e.event_type === EVENT_TYPES.COMPETITOR_GAINED)?.severity).toBe("negative");
  });

  it("emits engine_change_detected only when signature changes AND mention flips", () => {
    const flipped = diffObservation({
      prev: obs({ brand_mentioned: true }),
      curr: obs({ brand_mentioned: false }),
      prevSignature: normalizeResponse("Apple is great"),
      currSignature: normalizeResponse("Banana is great"),
    });
    expect(flipped.find((e) => e.event_type === EVENT_TYPES.ENGINE_CHANGE_DETECTED)).toBeDefined();

    const sameText = diffObservation({
      prev: obs({ brand_mentioned: true }),
      curr: obs({ brand_mentioned: false }),
      prevSignature: normalizeResponse("Apple is great"),
      currSignature: normalizeResponse("Apple is great"),
    });
    expect(sameText.find((e) => e.event_type === EVENT_TYPES.ENGINE_CHANGE_DETECTED)).toBeUndefined();
  });

  it("returns no events for a skipped current observation", () => {
    const events = diffObservation({ prev: null, curr: obs({ skipped: true }) });
    expect(events).toEqual([]);
  });

  it("does not emit citation deltas on the first observation", () => {
    const events = diffObservation({
      prev: null,
      curr: obs({ brand_mentioned: true }),
      currCitations: ["a.com", "b.com"],
    });
    expect(events.find((e) => e.event_type === EVENT_TYPES.CITATION_GAINED)).toBeUndefined();
  });
});

describe("bucketTrend", () => {
  const rows = [
    { observed_at: "2026-01-05T00:00:00.000Z", brand_mentioned: true, skipped: false, engine_name: "chatgpt" },
    { observed_at: "2026-01-20T00:00:00.000Z", brand_mentioned: false, skipped: false, engine_name: "chatgpt" },
    { observed_at: "2026-02-10T00:00:00.000Z", brand_mentioned: true, skipped: false, engine_name: "chatgpt" },
    { observed_at: "2026-02-15T00:00:00.000Z", brand_mentioned: null, skipped: true, engine_name: "chatgpt" },
  ];

  it("buckets by month with correct rates, excluding skips", () => {
    const out = bucketTrend(rows, "month");
    expect(out).toHaveLength(2);
    expect(out[0].bucket).toBe("2026-01-01");
    expect(out[0].total).toBe(2);
    expect(out[0].mentioned).toBe(1);
    expect(out[0].rate).toBe(50);
    expect(out[1].bucket).toBe("2026-02-01");
    expect(out[1].rate).toBe(100);
  });

  it("returns rate=null for a bucket with only skipped/null runs (never 0)", () => {
    const out = bucketTrend(
      [{ observed_at: "2026-03-01T00:00:00.000Z", brand_mentioned: null, skipped: true, engine_name: "x" }],
      "month",
    );
    expect(out[0].rate).toBeNull();
  });
});

describe("bucketCompetitorTrend", () => {
  const rows = [
    {
      observed_at: "2026-01-10T00:00:00.000Z",
      competitor_mentions: [{ name: "Rival", mentioned: true }],
    },
    {
      observed_at: "2026-01-20T00:00:00.000Z",
      competitor_mentions: [{ name: "Rival", mentioned: false }],
    },
    {
      observed_at: "2026-02-10T00:00:00.000Z",
      competitor_mentions: [{ name: "Rival", mentioned: true }],
    },
  ];

  it("aggregates per-competitor per-month mention counts", () => {
    const out = bucketCompetitorTrend(rows);
    expect(out["Rival"]).toHaveLength(2);
    expect(out["Rival"][0]).toMatchObject({ month: "2026-01-01", mentioned: 1, total: 2 });
    expect(out["Rival"][1]).toMatchObject({ month: "2026-02-01", mentioned: 1, total: 1 });
  });
});

describe("retention", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("returns null cutoff for unlimited", () => {
    expect(computeRetentionCutoff("unlimited", now)).toBeNull();
    expect(computeRetentionCutoff(undefined, now)).toBeNull();
  });

  it("returns 30d and 365d cutoffs", () => {
    const c30 = computeRetentionCutoff("30d", now)!;
    expect(Math.round((now.getTime() - c30.getTime()) / 86400000)).toBe(30);
    const c365 = computeRetentionCutoff("365d", now)!;
    expect(Math.round((now.getTime() - c365.getTime()) / 86400000)).toBe(365);
  });

  it("validates tiers", () => {
    expect(isRetentionTier("30d")).toBe(true);
    expect(isRetentionTier("unlimited")).toBe(true);
    expect(isRetentionTier("7d")).toBe(false);
    expect(isRetentionTier(null)).toBe(false);
  });
});

describe("bucketKey", () => {
  it("returns the month-start UTC key for the month bucket", () => {
    expect(bucketKey("2026-01-15T10:00:00.000Z", "month")).toBe("2026-01-01");
  });

  it("returns the day UTC key for the day bucket", () => {
    expect(bucketKey("2026-01-15T23:00:00.000Z", "day")).toBe("2026-01-15");
  });

  it("returns the Monday UTC key for the week bucket", () => {
    // 2026-01-15 is a Thursday → Monday of that week is 2026-01-12.
    expect(bucketKey("2026-01-15T00:00:00.000Z", "week")).toBe("2026-01-12");
    // 2026-01-11 is a Sunday → Monday of that week is 2026-01-05.
    expect(bucketKey("2026-01-11T00:00:00.000Z", "week")).toBe("2026-01-05");
  });
});

describe("normalizeResponse", () => {
  it("lowercases, collapses whitespace, and truncates", () => {
    expect(normalizeResponse("  Apple   is  GREAT  ")).toBe("apple is great");
    expect(normalizeResponse("")).toBeNull();
    expect(normalizeResponse(null)).toBeNull();
  });
});
