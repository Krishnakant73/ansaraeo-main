import { describe, expect, it } from "vitest";
import { recommendGoal, proposeFirstDraft, proposeAfterPublish } from "./copilot-proposals";
import type { ScanReport } from "./scan-classifier";

const REPORT = (overrides: Partial<ScanReport> = {}): ScanReport => ({
  brandName: "TestCo",
  domain: "test.co",
  visibilityScore: 30,
  totalAnswers: 9,
  brandMentionedAnswers: 3,
  perEngine: [],
  competitorScores: [],
  opportunities: [],
  sentiment: { positive: 0, neutral: 3, negative: 0 },
  ...overrides,
});

describe("recommendGoal", () => {
  it("defaults to chatgpt_mentions with no report", () => {
    expect(recommendGoal(null)).toBe("chatgpt_mentions");
  });

  it("returns chatgpt_mentions for a low score", () => {
    expect(recommendGoal(REPORT({ visibilityScore: 10 }))).toBe("chatgpt_mentions");
  });

  it("returns beat_competitor when a competitor leads by 50+ points", () => {
    expect(
      recommendGoal(
        REPORT({
          visibilityScore: 20,
          competitorScores: [{ name: "Rival", mentioned: 8, total: 9, rate: 89 }],
        }),
      ),
    ).toBe("beat_competitor");
  });
});

describe("proposeFirstDraft", () => {
  it("mentions the specific prompt in its message", () => {
    const p = proposeFirstDraft({
      brandName: "TestCo",
      mostInvisiblePrompt: "best neobank for freelancers",
      goal: "chatgpt_mentions",
    });
    expect(p.text).toContain("best neobank for freelancers");
    expect(p.cta.toLowerCase()).toContain("open");
  });

  it("degrades gracefully when there's no invisible prompt", () => {
    const p = proposeFirstDraft({
      brandName: "TestCo",
      mostInvisiblePrompt: null,
      goal: "chatgpt_mentions",
    });
    expect(p.action).toBe("mission-control");
  });
});

describe("proposeAfterPublish", () => {
  it("names the retest window and the prompt", () => {
    const p = proposeAfterPublish({ promptText: "best X" });
    expect(p.text).toContain("48h");
    expect(p.text).toContain("best X");
  });
});
