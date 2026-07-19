import { describe, it, expect } from "vitest";
import { scoreTone, statusChipClass } from "./site-audit-workspace";

describe("site-audit-workspace helpers", () => {
  describe("scoreTone", () => {
    it("returns positive for scores at or above 80", () => {
      expect(scoreTone(80)).toBe("positive");
      expect(scoreTone(100)).toBe("positive");
    });
    it("returns negative for scores below 50", () => {
      expect(scoreTone(0)).toBe("negative");
      expect(scoreTone(49)).toBe("negative");
    });
    it("returns undefined for the middle band", () => {
      expect(scoreTone(50)).toBeUndefined();
      expect(scoreTone(79)).toBeUndefined();
    });
    it("returns undefined for null (no score)", () => {
      expect(scoreTone(null)).toBeUndefined();
    });
  });

  describe("statusChipClass", () => {
    it("chooses tinted classes for known statuses", () => {
      expect(statusChipClass("pass")).toContain("emerald");
      expect(statusChipClass("warn")).toContain("amber");
      expect(statusChipClass("fail")).toContain("rose");
    });
    it("falls back to a neutral chip for unknown statuses", () => {
      expect(statusChipClass("skipped")).toBe("chip");
    });
  });
});
