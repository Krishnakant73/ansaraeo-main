import { describe, it, expect } from "vitest";
import { triggerLabel } from "./playbook-workspace";

describe("playbook-workspace helpers", () => {
  describe("triggerLabel", () => {
    it("humanizes canonical trigger types", () => {
      expect(triggerLabel("opportunity_type")).toBe("Opportunity type");
      expect(triggerLabel("engine")).toBe("Engine event");
      expect(triggerLabel("manual")).toBe("Manual only");
    });
    it("returns the raw string for unknown triggers", () => {
      expect(triggerLabel("schedule")).toBe("schedule");
      expect(triggerLabel("")).toBe("");
    });
  });
});
