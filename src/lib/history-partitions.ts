// ============================================================
// history-partitions.ts — PURE helpers for history-table partition naming.
//
// No DB, no fetch, no env, no "@/..." imports so this module is unit-testable
// without a database (vitest has no path alias). It mirrors the YYYY_MM
// partition naming used by ensure_history_partitions() / the range variant in
// migrations 016 / 018, so the month set computed here is exactly the set of
// partitions backfillBrand() must ensure exist before replaying old runs.
// ============================================================

/**
 * Inclusive list of monthly partition suffixes ("YYYY_MM") spanning from..to.
 * Used by backfillBrand() to know which historical partitions
 * ensure_history_partitions_for_range() must create before replaying runs
 * whose observed_at falls in those months. Returns [] for invalid/empty input.
 */
export function getHistoryPartitionMonths(fromIso: string, toIso: string): string[] {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return [];

  // Normalize direction so we always iterate forward. Mirrors the SQL
  // ensure_history_partitions_for_range(), which also swaps reversed inputs.
  const startMs = Math.min(a.getTime(), b.getTime());
  const endMs = Math.max(a.getTime(), b.getTime());

  const months: string[] = [];
  let cur = new Date(Date.UTC(new Date(startMs).getUTCFullYear(), new Date(startMs).getUTCMonth(), 1));
  const last = new Date(Date.UTC(new Date(endMs).getUTCFullYear(), new Date(endMs).getUTCMonth(), 1));
  while (cur.getTime() <= last.getTime()) {
    months.push(`${cur.getUTCFullYear()}_${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return months;
}
