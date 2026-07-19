import { describe, it, expect } from "vitest";
import { getHistoryPartitionMonths } from "./history-partitions";

// These cover the month-range logic backfillBrand() relies on so that old
// visibility_runs (dated months/years in the past) get their historical
// partitions created before replay — otherwise the INSERT fails.
describe("getHistoryPartitionMonths", () => {
  it("returns a single month for a same-month range", () => {
    expect(getHistoryPartitionMonths("2026-03-05T00:00:00.000Z", "2026-03-28T00:00:00.000Z")).toEqual([
      "2026_03",
    ]);
  });

  it("returns an inclusive month range across a year boundary", () => {
    expect(getHistoryPartitionMonths("2025-12-15T00:00:00.000Z", "2026-01-10T00:00:00.000Z")).toEqual([
      "2025_12",
      "2026_01",
    ]);
  });

  it("returns 13 months for a >12-month span (old-run backfill coverage)", () => {
    const months = getHistoryPartitionMonths("2025-01-01T00:00:00.000Z", "2026-01-31T00:00:00.000Z");
    expect(months).toHaveLength(13);
    expect(months[0]).toBe("2025_01");
    expect(months[months.length - 1]).toBe("2026_01");
  });

  it("handles reversed inputs by iterating forward", () => {
    expect(getHistoryPartitionMonths("2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toEqual([
      "2026_01",
      "2026_02",
    ]);
  });

  it("returns [] for invalid input (no partition work attempted)", () => {
    expect(getHistoryPartitionMonths("not-a-date", "2026-01-01T00:00:00.000Z")).toEqual([]);
    expect(getHistoryPartitionMonths("", "")).toEqual([]);
  });
});
