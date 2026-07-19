import { describe, it, expect } from "vitest";
import {
  INTENTS,
  INTENT_KEYS,
  isIntentKey,
  intentLabel,
  intentFunnelStage,
  mapStarterGroupToIntent,
  inferIntentFromText,
} from "./intent";

describe("intent taxonomy", () => {
  it("exposes the seven canonical intents", () => {
    expect(INTENT_KEYS).toHaveLength(7);
    expect(INTENT_KEYS).toContain("awareness");
    expect(INTENT_KEYS).toContain("purchase_intent");
  });

  it("labels and stages resolve", () => {
    expect(intentLabel("comparison")).toBe("Comparison");
    expect(intentFunnelStage("comparison")).toBe("middle");
    expect(intentFunnelStage("purchase_intent")).toBe("bottom");
    expect(intentLabel(null)).toBe("Uncategorized");
  });

  it("validates intent keys", () => {
    expect(isIntentKey("awareness")).toBe(true);
    expect(isIntentKey("nope")).toBe(false);
    expect(isIntentKey(42)).toBe(false);
  });

  it("maps starter groups to canonical intents", () => {
    expect(mapStarterGroupToIntent("recommend")).toBe("awareness");
    expect(mapStarterGroupToIntent("compare")).toBe("comparison");
    expect(mapStarterGroupToIntent("alternative")).toBe("comparison");
    expect(mapStarterGroupToIntent("define")).toBe("problem_solving");
    expect(mapStarterGroupToIntent("tutorial")).toBe("problem_solving");
    expect(mapStarterGroupToIntent("unknown")).toBe("awareness");
  });

  it("infers intent from prompt text", () => {
    expect(inferIntentFromText("best running shoes in india")).toBe("best_choice");
    expect(inferIntentFromText("nike vs adidas which is better")).toBe("comparison");
    expect(inferIntentFromText("buy protein powder online price")).toBe("purchase_intent");
    expect(inferIntentFromText("how to fix a leaking faucet")).toBe("problem_solving");
    expect(inferIntentFromText("plumber near me bangalore")).toBe("local_intent");
    expect(inferIntentFromText("our brand's refund policy")).toBe("branded");
  });
});
