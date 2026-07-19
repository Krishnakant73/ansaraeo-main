import { describe, it, expect } from "vitest";
import {
  K_ANONYMITY_THRESHOLD,
  isCellPublishable,
  suppress,
  isSuppressed,
} from "./benchmark-privacy";

describe("k-anonymity gate", () => {
  it("exposes the threshold constant", () => {
    expect(K_ANONYMITY_THRESHOLD).toBe(5);
  });

  it("publishes only at/above K distinct brands", () => {
    expect(isCellPublishable(0)).toBe(false);
    expect(isCellPublishable(4)).toBe(false);
    expect(isCellPublishable(5)).toBe(true);
    expect(isCellPublishable(6)).toBe(true);
    expect(isCellPublishable(null)).toBe(false);
    expect(isCellPublishable(undefined)).toBe(false);
  });
});

describe("suppress wrapper", () => {
  const cell = { mention_rate: 0.42, brand_count: 12 };

  it("returns Suppressed (no metric leakage) when below K", () => {
    const r = suppress(cell, 3);
    expect(r.published).toBe(false);
    expect(isSuppressed(r)).toBe(true);
    // @ts-expect-error — suppressed cells must not carry metrics
    expect(r.mention_rate).toBeUndefined();
  });

  it("returns the cell with published:true at/above K", () => {
    const r = suppress(cell, 7);
    expect(r.published).toBe(true);
    expect(isSuppressed(r)).toBe(false);
    expect((r as { mention_rate: number }).mention_rate).toBe(0.42);
  });

  it("suppresses a null cell even with a large brand count", () => {
    const r = suppress(null, 99);
    expect(r.published).toBe(false);
    expect(isSuppressed(r)).toBe(true);
  });
});
