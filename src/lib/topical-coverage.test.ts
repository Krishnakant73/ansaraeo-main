import { describe, it, expect } from "vitest";
import { buildTopicalCoverage, extractTokens } from "./topical-coverage";

describe("extractTokens", () => {
  it("pulls significant path tokens and drops stopwords/short segments", () => {
    const tokens = extractTokens([
      "https://ex.com/skincare/face-wash",
      "https://ex.com/blog/best-face-wash",
      "https://ex.com/about",
      "https://ex.com/contact",
    ]);
    expect(tokens.has("skincare")).toBe(true);
    expect(tokens.has("face")).toBe(true);
    expect(tokens.has("wash")).toBe(true);
    expect(tokens.has("blog")).toBe(true);
    // structural / stopword segments excluded
    expect(tokens.has("about")).toBe(false);
    expect(tokens.has("contact")).toBe(false);
  });
});

describe("buildTopicalCoverage", () => {
  const brand = ["https://brand.com/skincare/serum", "https://brand.com/blog/ai-search"];
  const compA = ["https://compa.com/skincare/face-wash", "https://compa.com/comparisons"];
  const compB = ["https://compb.com/skincare/face-wash", "https://compb.com/guides"];

  it("surfaces gap topics (competitors have, brand lacks) sorted by coverage", () => {
    const res = buildTopicalCoverage("https://brand.com", brand, [
      { domain: "https://compa.com", urls: compA },
      { domain: "https://compb.com", urls: compB },
    ]);

    // "face" + "wash" covered by both competitors, brand lacks → top gaps
    const topGap = res.gapTokens[0];
    expect(topGap.competitorCount).toBe(2);
    expect(topGap.brandHas).toBe(false);

    // "skincare" is covered by brand + both competitors → not a gap, not a strength
    const skincare = [...res.gapTokens, ...res.strengthTokens].find((t) => t.token === "skincare");
    expect(skincare).toBeUndefined();

    // "serum" only brand has → strength (note: "ai"/"search" are dropped by length/stopword rules)
    expect(res.strengthTokens.some((t) => t.token === "serum")).toBe(true);
  });

  it("returns no gaps when the brand covers every competitor token", () => {
    const res = buildTopicalCoverage("https://brand.com", [...brand, "https://brand.com/skincare/face-wash", "https://brand.com/comparisons", "https://brand.com/guides"], [
      { domain: "https://compa.com", urls: compA },
    ]);
    expect(res.gapTokens.length).toBe(0);
  });
});
