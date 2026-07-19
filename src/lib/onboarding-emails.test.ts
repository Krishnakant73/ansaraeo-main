import { describe, expect, it } from "vitest";
import {
  competitorAlertEmail,
  reportReadyEmail,
  weeklyDigestEmail,
  pickWeeklyDigestAction,
} from "./onboarding-emails";
import type { ScanReport } from "./scan-classifier";

describe("reportReadyEmail", () => {
  it("uses the domain in the subject line", () => {
    const built = reportReadyEmail({
      email: "a@b.com",
      brandName: "Acme",
      domain: "acme.com",
      score: 42,
    });
    expect(built.email.subject).toContain("acme.com");
    expect(built.email.text).toContain("42/100");
    expect(built.whatsapp.params).toEqual(["Acme", "42"]);
  });
});

describe("competitorAlertEmail", () => {
  it("leads the subject with the competitor's number", () => {
    const built = competitorAlertEmail({
      email: "a@b.com",
      brandName: "Acme",
      competitorName: "Rival",
      competitorMentions: 7,
      brandMentions: 1,
      total: 9,
    });
    expect(built.email.subject).toMatch(/Rival appears in 7 answers/);
    expect(built.email.subject).toMatch(/You appear in 1/);
  });
});

describe("weeklyDigestEmail", () => {
  it("shows the counts and the one action", () => {
    const built = weeklyDigestEmail({
      email: "a@b.com",
      brandName: "Acme",
      wins: ["Mentioned in ChatGPT for 'x'"],
      losses: ["Rival added a page for 'x'"],
      recommendedAction: "Draft the counter",
    });
    expect(built.email.subject).toContain("1 wins, 1 losses");
    expect(built.email.text).toContain("Draft the counter");
  });
});

describe("pickWeeklyDigestAction", () => {
  it("returns a baseline message with no report", () => {
    const out = pickWeeklyDigestAction(null);
    expect(out.action).toContain("baseline");
  });

  it("surfaces the top opportunity as the recommended action when available", () => {
    const report: ScanReport = {
      brandName: "Acme",
      domain: "acme.com",
      visibilityScore: 20,
      totalAnswers: 10,
      brandMentionedAnswers: 2,
      perEngine: [],
      competitorScores: [{ name: "Rival", mentioned: 5, total: 10, rate: 50 }],
      opportunities: [
        { prompt: "best X in India", engine: "chatgpt", competitors_present: ["Rival"], snippet: "..." },
      ],
      sentiment: { positive: 0, neutral: 0, negative: 0 },
    };
    const out = pickWeeklyDigestAction(report);
    expect(out.action).toContain("best X in India");
    expect(out.losses[0]).toContain("Rival");
  });
});
