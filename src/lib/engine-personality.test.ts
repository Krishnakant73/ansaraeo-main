import { describe, it, expect } from "vitest";
import { derivePersonality, EMPTY_PERSONALITY } from "./engine-personality";

// ============================================================
// derivePersonality is the pure deriver — no DB dependency — so
// these tests exercise the classifier directly with hand-built
// row shapes.
// ============================================================

function mkRun(over: Partial<Parameters<typeof derivePersonality>[0][number]> = {}) {
  return {
    id: over.id ?? "r1",
    raw_response: over.raw_response ?? null,
    tokens_used: over.tokens_used ?? null,
    competitor_mentions: over.competitor_mentions ?? null,
  };
}

describe("derivePersonality", () => {
  it("returns EMPTY_PERSONALITY when there are no runs", () => {
    const p = derivePersonality([], []);
    expect(p).toEqual(EMPTY_PERSONALITY);
  });

  it("scores verbosity from median tokens_used vs the 1500-token cap", () => {
    const runs = [
      mkRun({ id: "a", tokens_used: 750 }),
      mkRun({ id: "b", tokens_used: 750 }),
      mkRun({ id: "c", tokens_used: 750 }),
    ];
    const p = derivePersonality(runs, []);
    // median 750 / 1500 → 50.
    expect(p.verbosity).toBe(50);
    expect(p.runs_observed).toBe(3);
  });

  it("counts hedge words per response", () => {
    const runs = [
      mkRun({ id: "a", raw_response: "This may work for most teams." }),
      mkRun({ id: "b", raw_response: "This is definitive." }),
      mkRun({ id: "c", raw_response: "This might apply, likely." }),
      mkRun({ id: "d", raw_response: "Nothing wavering here." }),
    ];
    const p = derivePersonality(runs, []);
    // 2 of 4 responses have hedge words → 50.
    expect(p.hedging).toBe(50);
  });

  it("detects bullet-list formatting bias", () => {
    const runs = [
      mkRun({ id: "a", raw_response: "Answer:\n- one\n- two\n- three" }),
      mkRun({ id: "b", raw_response: "Just a paragraph." }),
    ];
    const p = derivePersonality(runs, []);
    expect(p.format_bias).toBe(50);
  });

  it("scores freshness bias from year-tagged citation URLs", () => {
    // 2 recent, 2 stale → 50 pct
    const runs = [mkRun({ id: "a" })];
    const cits = [
      { run_id: "a", cited_url: "https://example.com/blog/2026/post", cited_domain: "example.com" },
      { run_id: "a", cited_url: "https://example.com/blog/2025/post", cited_domain: "example.com" },
      { run_id: "a", cited_url: "https://example.com/blog/2019/post", cited_domain: "example.com" },
      { run_id: "a", cited_url: "https://example.com/blog/2018/post", cited_domain: "example.com" },
    ];
    const p = derivePersonality(runs, cits);
    expect(p.freshness_bias).toBe(50);
  });

  it("clamps citation density at the 5-per-run cap", () => {
    const runs = [mkRun({ id: "a" })];
    const cits = Array.from({ length: 12 }, (_, i) => ({
      run_id: "a",
      cited_url: `https://example.com/x/${i}`,
      cited_domain: "example.com",
    }));
    const p = derivePersonality(runs, cits);
    expect(p.citation_density).toBe(100);
  });

  it("computes entity resolution from top-3 competitor positions", () => {
    const runs = [
      mkRun({
        id: "a",
        competitor_mentions: [{ name: "Rival", mentioned: true, position: 2 }],
      }),
      mkRun({
        id: "b",
        competitor_mentions: [{ name: "Rival", mentioned: true, position: 7 }],
      }),
    ];
    const p = derivePersonality(runs, []);
    // 1 of 2 runs has a top-3 mention → 50.
    expect(p.entity_resolution).toBe(50);
  });

  it("caps sample_run_ids at 20 entries", () => {
    const runs = Array.from({ length: 30 }, (_, i) => mkRun({ id: `r${i}` }));
    const p = derivePersonality(runs, []);
    expect(p.sample_run_ids).toHaveLength(20);
    expect(p.runs_observed).toBe(30);
  });
});
