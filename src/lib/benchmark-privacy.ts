// ============================================================
// benchmark-privacy.ts — the privacy gate for the anonymous warehouse.
//
// Single source of truth for k-anonymity. A benchmark cell (a dimension +
// period combination) is only published when it aggregates at least
// K_ANONYMITY_THRESHOLD DISTINCT brands. Below that, we return an honest
// "insufficient_data" signal and never a number — so no single brand can be
// re-identified from the public benchmark, and we never fabricate a metric
// (HONESTY DESIGN). The warehouse table itself stores no brand_id.
// ============================================================

/** Minimum distinct brands required before a benchmark cell may be published. */
export const K_ANONYMITY_THRESHOLD = 5;

/** A published (safe-to-expose) benchmark payload. */
export type Published<T> = T & { published: true };

/** A suppressed cell — never carries metric values. */
export type Suppressed = { published: false; insufficient_data: true };

export function isCellPublishable(brandCount: number | null | undefined): boolean {
  return (brandCount ?? 0) >= K_ANONYMITY_THRESHOLD;
}

/**
 * Wrap a computed cell in the privacy gate. When the cell is missing or the
 * brand count is below K, return Suppressed (no metric leakage). Otherwise
 * return the cell with `published: true`.
 */
export function suppress<T extends object>(
  cell: T | null | undefined,
  brandCount: number | null | undefined,
): Published<T> | Suppressed {
  if (!cell || !isCellPublishable(brandCount)) {
    return { published: false, insufficient_data: true };
  }
  return { ...cell, published: true };
}

/** True when a value should be withheld from a response (privacy). */
export function isSuppressed(result: Published<unknown> | Suppressed): result is Suppressed {
  return result.published === false;
}
