// Branded-search lift — pure helpers (no @/ imports, so they're unit-testable
// without the vitest alias). Splits GSC query rows into branded (contain the
// brand name) vs the rest, aggregates each over a baseline + comparison period,
// and reports the lift. No network, no estimation — only the rows GSC returns.
//
// gsc.ts re-exports these and adds the fetch-aware getBrandedLift().

export type GscAgg = { clicks: number; impressions: number; ctr: number; position: number };
export type BrandedLiftGroup = {
  baseline: GscAgg;
  comparison: GscAgg;
  impressionsLiftPct: number | null;
  clicksLiftPct: number | null;
  ctrDelta: number | null;
  positionDelta: number | null;
};
export type BrandedLift = {
  branded: BrandedLiftGroup;
  nonBranded: BrandedLiftGroup;
  brandedImpressionSharePct: number | null; // comparison-period share of total impressions
  topBrandedQueries: string[];
};

type GscRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };

function aggregate(rows: GscRow[]): GscAgg {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    posWeighted += r.position * r.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 10000 : 0,
    position: impressions > 0 ? Math.round((posWeighted / impressions) * 100) / 100 : 0,
  };
}

function pctLift(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function delta(cur: number, prev: number): number | null {
  if (cur === 0 && prev === 0) return 0;
  return Math.round((cur - prev) * 10000) / 10000;
}

function groupLift(
  baselineRows: GscRow[],
  comparisonRows: GscRow[],
  isBrandedFn: (q: string) => boolean,
): BrandedLiftGroup {
  const b = aggregate(baselineRows.filter((r) => isBrandedFn(r.query)));
  const c = aggregate(comparisonRows.filter((r) => isBrandedFn(r.query)));
  return {
    baseline: b,
    comparison: c,
    impressionsLiftPct: pctLift(c.impressions, b.impressions),
    clicksLiftPct: pctLift(c.clicks, b.clicks),
    ctrDelta: delta(c.ctr, b.ctr),
    positionDelta: delta(c.position, b.position),
  };
}

export function computeBrandedLift(
  baselineRows: GscRow[],
  comparisonRows: GscRow[],
  brandName: string,
): BrandedLift {
  const name = (brandName || "").trim().toLowerCase();
  const isBrandedFn = (q: string) => Boolean(name) && q.toLowerCase().includes(name);

  const branded = groupLift(baselineRows, comparisonRows, isBrandedFn);
  const nonBranded = groupLift(baselineRows, comparisonRows, (q) => !isBrandedFn(q));

  const totalComparisonImpr = branded.comparison.impressions + nonBranded.comparison.impressions;
  const brandedImpressionSharePct =
    totalComparisonImpr > 0
      ? Math.round((branded.comparison.impressions / totalComparisonImpr) * 100)
      : null;

  const topBrandedQueries = comparisonRows
    .filter((r) => isBrandedFn(r.query))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map((r) => r.query);

  return { branded, nonBranded, brandedImpressionSharePct, topBrandedQueries };
}
