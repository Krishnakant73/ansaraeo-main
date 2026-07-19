import { describe, it, expect } from "vitest";
import { evaluateRule } from "./alerts";

describe("evaluateRule", () => {
  it("level mode (down): breaches at or below threshold", () => {
    expect(evaluateRule({ direction: "down", mode: "level", threshold: 30 }, 25, null).breached).toBe(true);
    expect(evaluateRule({ direction: "down", mode: "level", threshold: 30 }, 30, null).breached).toBe(true);
    expect(evaluateRule({ direction: "down", mode: "level", threshold: 30 }, 31, null).breached).toBe(false);
  });

  it("level mode (up): breaches at or above threshold", () => {
    expect(evaluateRule({ direction: "up", mode: "level", threshold: 40 }, 45, null).breached).toBe(true);
    expect(evaluateRule({ direction: "up", mode: "level", threshold: 40 }, 40, null).breached).toBe(true);
    expect(evaluateRule({ direction: "up", mode: "level", threshold: 40 }, 39, null).breached).toBe(false);
  });

  it("delta mode (down): breaches when drop >= threshold", () => {
    expect(evaluateRule({ direction: "down", mode: "delta", threshold: 15 }, 60, 80).breached).toBe(true); // -20
    expect(evaluateRule({ direction: "down", mode: "delta", threshold: 15 }, 66, 80).breached).toBe(false); // -14
    expect(evaluateRule({ direction: "down", mode: "delta", threshold: 15 }, 60, null).breached).toBe(false); // no prev
  });

  it("delta mode (up): breaches when rise >= threshold", () => {
    expect(evaluateRule({ direction: "up", mode: "delta", threshold: 10 }, 50, 35).breached).toBe(true); // +15
    expect(evaluateRule({ direction: "up", mode: "delta", threshold: 10 }, 44, 35).breached).toBe(false); // +9
  });

  it("null current value never breaches", () => {
    expect(evaluateRule({ direction: "down", mode: "level", threshold: 0 }, null, null).breached).toBe(false);
    expect(evaluateRule({ direction: "down", mode: "delta", threshold: 5 }, null, 10).breached).toBe(false);
  });
});
