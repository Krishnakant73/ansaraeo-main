import { describe, it, expect } from "vitest";
import { buildShapeRail } from "./content-engine";
import { EMPTY_PERSONALITY } from "./engine-personality";

// ============================================================
// buildShapeRail — deterministic mapping from personality → rail
// text. Only the deterministic path has tests; the LLM call in
// generateContentDraft is exercised at build time and never
// touched by tests (it costs money and it's non-deterministic).
// ============================================================

describe("buildShapeRail", () => {
  it("names the target engine in the header", () => {
    const rail = buildShapeRail({
      engineName: "chatgpt",
      engineDisplay: "ChatGPT",
      personality: { ...EMPTY_PERSONALITY },
    });
    expect(rail).toContain("TARGET ENGINE: ChatGPT");
  });

  it("emits the ChatGPT-specific move", () => {
    const rail = buildShapeRail({
      engineName: "chatgpt",
      engineDisplay: "ChatGPT",
      personality: { ...EMPTY_PERSONALITY },
    });
    expect(rail).toMatch(/Recommendation:/);
  });

  it("emits the Perplexity-specific move", () => {
    const rail = buildShapeRail({
      engineName: "perplexity",
      engineDisplay: "Perplexity",
      personality: { ...EMPTY_PERSONALITY },
    });
    expect(rail).toMatch(/Sources & further reading/);
  });

  it("prefers bullets when format_bias is high", () => {
    const rail = buildShapeRail({
      engineName: "chatgpt",
      engineDisplay: "ChatGPT",
      personality: { ...EMPTY_PERSONALITY, format_bias: 80 },
    });
    expect(rail).toMatch(/prefer bulleted lists/);
  });

  it("prefers prose when format_bias is low", () => {
    const rail = buildShapeRail({
      engineName: "chatgpt",
      engineDisplay: "ChatGPT",
      personality: { ...EMPTY_PERSONALITY, format_bias: 20 },
    });
    expect(rail).toMatch(/prefer flowing prose/);
  });

  it("goes prescriptive when hedging is low", () => {
    const rail = buildShapeRail({
      engineName: "chatgpt",
      engineDisplay: "ChatGPT",
      personality: { ...EMPTY_PERSONALITY, hedging: 15 },
    });
    expect(rail).toMatch(/prescriptive/);
  });

  it("asks for [ADD SOURCE URL:] placeholders when citation_density is high", () => {
    const rail = buildShapeRail({
      engineName: "perplexity",
      engineDisplay: "Perplexity",
      personality: { ...EMPTY_PERSONALITY, citation_density: 80 },
    });
    expect(rail).toContain("[ADD SOURCE URL:");
  });

  it("aims long when verbosity is high", () => {
    const rail = buildShapeRail({
      engineName: "chatgpt",
      engineDisplay: "ChatGPT",
      personality: { ...EMPTY_PERSONALITY, verbosity: 90 },
    });
    expect(rail).toMatch(/upper end/);
  });

  it("aims short when verbosity is low", () => {
    const rail = buildShapeRail({
      engineName: "chatgpt",
      engineDisplay: "ChatGPT",
      personality: { ...EMPTY_PERSONALITY, verbosity: 15 },
    });
    expect(rail).toMatch(/tight/);
  });
});
