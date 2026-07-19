import { describe, it, expect } from "vitest";
import { deterministicMentionCheck, reconcileMentionSignal } from "./mention-matcher";

describe("deterministicMentionCheck", () => {
  it("finds an exact brand mention (case-insensitive, strips www.)", () => {
    expect(deterministicMentionCheck("Buy from ExampleBrand today", "examplebrand")).toBe(true);
    expect(deterministicMentionCheck("www.ExampleBrand is great", "examplebrand")).toBe(true);
  });

  it("returns false when the brand is absent", () => {
    expect(deterministicMentionCheck("No brand here at all", "examplebrand")).toBe(false);
  });

  it("tolerates a single-character misspelling via the fuzzy window", () => {
    expect(deterministicMentionCheck("We love ExampleBrnd coffee", "examplebrand")).toBe(true);
  });

  it("matches multi-word brand names as a phrase", () => {
    expect(deterministicMentionCheck("Acme Coffee Co is mentioned", "acme coffee co")).toBe(true);
    expect(deterministicMentionCheck("Acme Coffee Co is mentioned", "acme tea co")).toBe(false);
  });
});

describe("reconcileMentionSignal", () => {
  it("trusts the deterministic result when it disagrees with the LLM", () => {
    // LLM says NOT mentioned, but the name is literally present -> deterministic wins.
    const r = reconcileMentionSignal(false, "ExampleBrand is the best", "examplebrand");
    expect(r.deterministicResult).toBe(true);
    expect(r.agreed).toBe(false);
    expect(r.finalVerdict).toBe(true);
  });

  it("agrees and returns the LLM verdict when both say mentioned", () => {
    const r = reconcileMentionSignal(true, "ExampleBrand is the best", "examplebrand");
    expect(r.agreed).toBe(true);
    expect(r.finalVerdict).toBe(true);
  });

  it("returns not-mentioned when neither signal finds it", () => {
    const r = reconcileMentionSignal(false, "nothing relevant at all", "examplebrand");
    expect(r.deterministicResult).toBe(false);
    expect(r.finalVerdict).toBe(false);
  });
});
