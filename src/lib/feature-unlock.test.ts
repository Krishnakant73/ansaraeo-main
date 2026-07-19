import { describe, expect, it } from "vitest";
import { getUnlockedFeatures } from "./feature-unlock";

// Baseline is a brand created today, no events, solo org — should
// unlock only the always-available features + site_audit (which
// unlocks on scan_hydrated OR at 7 days).

const today = () => new Date();
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe("getUnlockedFeatures", () => {
  it("always shows mission_control, visibility, competitors, prompts, settings", () => {
    const set = getUnlockedFeatures({
      createdAt: today(),
      events: new Set(),
      orgMode: "solo",
    });
    expect(set.has("mission_control")).toBe(true);
    expect(set.has("visibility")).toBe(true);
    expect(set.has("competitors")).toBe(true);
    expect(set.has("prompts")).toBe(true);
    expect(set.has("settings")).toBe(true);
  });

  it("hides answer_blocks until a draft is saved", () => {
    const before = getUnlockedFeatures({
      createdAt: today(),
      events: new Set(),
      orgMode: "solo",
    });
    expect(before.has("answer_blocks")).toBe(false);
    const after = getUnlockedFeatures({
      createdAt: today(),
      events: new Set(["first_draft_saved"]),
      orgMode: "solo",
    });
    expect(after.has("answer_blocks")).toBe(true);
    expect(after.has("geo_linter")).toBe(true);
    expect(after.has("schema_for_ai")).toBe(true);
  });

  it("unlocks citations only after first mention", () => {
    const before = getUnlockedFeatures({
      createdAt: today(),
      events: new Set(),
      orgMode: "solo",
    });
    expect(before.has("citations")).toBe(false);
    const after = getUnlockedFeatures({
      createdAt: today(),
      events: new Set(["first_mention_detected"]),
      orgMode: "solo",
    });
    expect(after.has("citations")).toBe(true);
  });

  it("unlocks site_audit immediately on scan hydration", () => {
    const set = getUnlockedFeatures({
      createdAt: today(),
      events: new Set(["scan_hydrated"]),
      orgMode: "solo",
    });
    expect(set.has("site_audit")).toBe(true);
    // Week 2 tools still hidden until 14 days.
    expect(set.has("ai_index")).toBe(false);
    expect(set.has("llms_txt")).toBe(false);
  });

  it("unlocks week-2 tools at day 14", () => {
    const set = getUnlockedFeatures({
      createdAt: daysAgo(14),
      events: new Set(),
      orgMode: "solo",
    });
    expect(set.has("ai_index")).toBe(true);
    expect(set.has("llms_txt")).toBe(true);
    expect(set.has("robots_check")).toBe(true);
  });

  it("unlocks month-2 tools at day 30", () => {
    const set = getUnlockedFeatures({
      createdAt: daysAgo(30),
      events: new Set(),
      orgMode: "solo",
    });
    expect(set.has("revenue_attribution")).toBe(true);
    expect(set.has("gsc")).toBe(true);
    expect(set.has("gbp")).toBe(true);
    expect(set.has("benchmark")).toBe(true);
  });

  it("unlocks agency features when org mode is agency", () => {
    const solo = getUnlockedFeatures({ createdAt: today(), events: new Set(), orgMode: "solo" });
    expect(solo.has("agency")).toBe(false);
    const agency = getUnlockedFeatures({ createdAt: today(), events: new Set(), orgMode: "agency" });
    expect(agency.has("agency")).toBe(true);
    expect(agency.has("campaigns")).toBe(true);
    expect(agency.has("playbooks")).toBe(true);
  });
});
