import { describe, it, expect } from "vitest";
import {
  parseBrandPerception,
  aggregatePerceptions,
  judgePositioningGap,
  type BrandPerception,
  type IntendedPositioning,
} from "./brand-perception";

const emptyIntended: IntendedPositioning = {
  category: null,
  target_customer: null,
  differentiators: [],
  best_for: [],
  transformation_from: null,
  transformation_to: null,
};

describe("parseBrandPerception", () => {
  it("coerces a well-formed payload", () => {
    const p = parseBrandPerception({
      perceived_category: "AI search tool",
      strengths: ["India-first", "transparent billing"],
      weaknesses: ["no dark patterns"],
      recommended_for: ["D2C brands"],
      tone: "positive",
    });
    expect(p.perceived_category).toBe("AI search tool");
    expect(p.strengths).toEqual(["India-first", "transparent billing"]);
    expect(p.weaknesses).toEqual(["no dark patterns"]);
    expect(p.recommended_for).toEqual(["D2C brands"]);
    expect(p.tone).toBe("positive");
  });

  it("returns neutral tone for unknown tone values", () => {
    const p = parseBrandPerception({ tone: "angry" });
    expect(p.tone).toBe("neutral");
  });

  it("handles missing fields and non-array inputs gracefully", () => {
    const p = parseBrandPerception({ strengths: "not an array", tone: "neutral" });
    expect(p.strengths).toEqual([]);
    expect(p.perceived_category).toBeNull();
    expect(p.tone).toBe("neutral");
  });

  it("returns a safe empty perception for non-object input", () => {
    const p = parseBrandPerception(null);
    expect(p).toEqual({
      perceived_category: null,
      strengths: [],
      weaknesses: [],
      recommended_for: [],
      tone: "neutral",
    });
  });

  it("trims and caps array items", () => {
    const big = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const p = parseBrandPerception({ strengths: big });
    expect(p.strengths.length).toBe(12);
    expect(p.strengths[0]).toBe("s0");
  });
});

describe("aggregatePerceptions", () => {
  const rows: BrandPerception[] = [
    { perceived_category: "AI tool", strengths: ["fast", "india"], weaknesses: [], recommended_for: ["D2C"], tone: "positive" },
    { perceived_category: "AI tool", strengths: ["fast", "cheap"], weaknesses: ["slow ui"], recommended_for: ["agencies"], tone: "neutral" },
    { perceived_category: "SEO tool", strengths: ["india"], weaknesses: ["slow ui"], recommended_for: ["D2C"], tone: "positive" },
  ];

  it("counts categories, strengths, weaknesses, recommended_for and tone", () => {
    const agg = aggregatePerceptions(rows);
    expect(agg.perceived_categories[0]).toEqual({ value: "AI tool", count: 2 });
    const fast = agg.strengths.find((s) => s.value === "fast");
    expect(fast?.count).toBe(2);
    expect(agg.weaknesses.find((w) => w.value === "slow ui")?.count).toBe(2);
    expect(agg.recommended_for.find((r) => r.value === "D2C")?.count).toBe(2);
    expect(agg.tone_mix).toEqual({ positive: 2, neutral: 1, negative: 0 });
  });
});

describe("judgePositioningGap", () => {
  const intended: IntendedPositioning = {
    category: "AI search visibility tool",
    target_customer: "Indian D2C brands",
    differentiators: ["India-first", "transparent billing"],
    best_for: ["tracking AI mentions", "competitor battlecards"],
    transformation_from: null,
    transformation_to: null,
  };

  it("scores 100 when actual matches intended across the board", () => {
    const agg = aggregatePerceptions([
      {
        perceived_category: "AI search visibility tool",
        strengths: ["India-first", "transparent billing"],
        weaknesses: [],
        recommended_for: ["tracking AI mentions", "competitor battlecards"],
        tone: "positive",
      },
    ]);
    const gap = judgePositioningGap(intended, agg);
    expect(gap.categoryMatch).toBe(true);
    expect(gap.alignmentScore).toBe(100);
    expect(gap.differentiatorsMissing).toEqual([]);
    expect(gap.bestForMissing).toEqual([]);
  });

  it("splits covered vs missing for partial coverage", () => {
    const agg = aggregatePerceptions([
      {
        perceived_category: "AI search visibility tool",
        strengths: ["India-first"],
        weaknesses: [],
        recommended_for: ["tracking AI mentions"],
        tone: "neutral",
      },
    ]);
    const gap = judgePositioningGap(intended, agg);
    expect(gap.differentiatorsCovered).toEqual(["India-first"]);
    expect(gap.differentiatorsMissing).toEqual(["transparent billing"]);
    expect(gap.bestForCovered).toEqual(["tracking AI mentions"]);
    expect(gap.bestForMissing).toEqual(["competitor battlecards"]);
    // 0.4 (category) + 0.3*0.5 (diff) + 0.3*0.5 (best) = 0.4 + 0.15 + 0.15 = 0.7 => 70
    expect(gap.alignmentScore).toBe(70);
  });

  it("flags category mismatch when actual category diverges", () => {
    const agg = aggregatePerceptions([
      {
        perceived_category: "SEO audit software",
        strengths: ["India-first", "transparent billing"],
        weaknesses: [],
        recommended_for: ["tracking AI mentions", "competitor battlecards"],
        tone: "neutral",
      },
    ]);
    const gap = judgePositioningGap(intended, agg);
    expect(gap.categoryMatch).toBe(false);
    expect(gap.alignmentScore).toBe(60); // category 0 + diff 0.3 + best 0.3
  });

  it("treats no intended claim as no mismatch (score from coverage only)", () => {
    const agg = aggregatePerceptions([
      { perceived_category: "something else", strengths: [], weaknesses: [], recommended_for: [], tone: "neutral" },
    ]);
    const gap = judgePositioningGap(emptyIntended, agg);
    expect(gap.categoryMatch).toBe(true); // no category claim => no mismatch
    expect(gap.alignmentScore).toBe(100);
  });
});
