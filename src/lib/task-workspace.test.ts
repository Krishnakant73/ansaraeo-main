import { describe, it, expect } from "vitest";
import { statusTone, typeLabel } from "./task-workspace";

describe("task-workspace helpers", () => {
  describe("statusTone", () => {
    it("returns accent for done", () => {
      expect(statusTone("done")).toBe("accent");
    });
    it("returns accent for active-work statuses", () => {
      expect(statusTone("in_progress")).toBe("accent");
      expect(statusTone("in_review")).toBe("accent");
    });
    it("returns danger for blocked and cancelled", () => {
      expect(statusTone("blocked")).toBe("danger");
      expect(statusTone("cancelled")).toBe("danger");
    });
    it("returns neutral for backlog/todo/unknown", () => {
      expect(statusTone("backlog")).toBe("neutral");
      expect(statusTone("todo")).toBe("neutral");
      expect(statusTone("unknown_status")).toBe("neutral");
    });
  });

  describe("typeLabel", () => {
    it("humanizes canonical task types", () => {
      expect(typeLabel("fix")).toBe("Fix");
      expect(typeLabel("content")).toBe("Content");
      expect(typeLabel("approve")).toBe("Approval");
      expect(typeLabel("deploy")).toBe("Deploy");
      expect(typeLabel("verify")).toBe("Verify");
    });
    it("returns the raw string for unknown types", () => {
      expect(typeLabel("custom-thing")).toBe("custom-thing");
      expect(typeLabel("")).toBe("");
    });
  });
});
