import { describe, it, expect } from "vitest";
import { runGeoLint } from "./geo-linter";

describe("runGeoLint (text mode)", () => {
  it("returns a scored result without fetching when given text", async () => {
    const result = await runGeoLint({
      text:
        "What is the best way to brew coffee? Brewing great coffee starts with fresh beans. " +
        "Use a 1:16 coffee-to-water ratio. Grind just before brewing for maximum flavor.",
    });

    expect(result.source.mode).toBe("text");
    expect(typeof result.score).toBe("number");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.wordCount).toBe("number");
  });

  it("still scores empty/short text without throwing", async () => {
    const result = await runGeoLint({ text: "short" });
    expect(result.source.mode).toBe("text");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
