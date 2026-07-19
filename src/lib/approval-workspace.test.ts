import { describe, it, expect } from "vitest";
import { statusChipClass, targetLabel } from "./approval-workspace";

describe("approval-workspace helpers", () => {
  describe("statusChipClass", () => {
    it("returns emerald for approved", () => {
      expect(statusChipClass("approved")).toContain("emerald");
    });
    it("returns rose for rejected", () => {
      expect(statusChipClass("rejected")).toContain("rose");
    });
    it("returns amber for pending", () => {
      expect(statusChipClass("pending")).toContain("amber");
    });
    it("falls back for anything else", () => {
      expect(statusChipClass("unknown")).toBe("chip");
    });
  });

  describe("targetLabel", () => {
    it("labels a task target with its title", () => {
      const label = targetLabel({
        kind: "task",
        id: "t1",
        title: "Fix broken schema",
        mission_id: "m1",
      });
      expect(label).toBe("Task · Fix broken schema");
    });
    it("labels a content target with its title", () => {
      const label = targetLabel({
        kind: "content",
        id: "c1",
        title: "Best sneakers for monsoons",
      });
      expect(label).toBe("Content · Best sneakers for monsoons");
    });
    it("uses a placeholder when a content target has no title", () => {
      const label = targetLabel({
        kind: "content",
        id: "c1",
        title: null,
      });
      expect(label).toBe("Content · Untitled draft");
    });
    it("returns a fallback when target is null", () => {
      expect(targetLabel(null)).toBe("Unknown target");
    });
  });
});
