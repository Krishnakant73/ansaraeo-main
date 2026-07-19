import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import Link from "next/link";
import BenchmarkCenter, {
  type BenchmarkCenterData,
  type CellStat,
  type BarDatum,
} from "@/components/dashboard/benchmark/BenchmarkCenter";
import {
  getBenchmarkCell,
  getYourPosition,
  getLeaderboard,
  getHistoricalTrend,
  getBrandTrend,
  type BenchmarkCell,
} from "@/lib/benchmark-engine";
import { bucketMonth } from "@/lib/benchmark-metrics";
import { industryLabel, regionLabel, normalizeIndustry, countryToRegion } from "@/lib/industry-taxonomy";
import { languageName } from "@/lib/languages";
import { cachedBenchmark } from "@/lib/benchmark-cache";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";

function toCellStat(cell: BenchmarkCell | null): CellStat {
  return {
    avg: cell?.avg ?? null,
    p50: cell?.p50 ?? null,
    p90: cell?.p90 ?? null,
    brandCount: cell?.brand_count ?? 0,
    published: cell?.published ?? false,
  };
}

function labelForDimensionValue(type: string, value: string): string {
  if (type === "industry") return industryLabel(value);
  if (type === "region") return regionLabel(value);
  if (type === "language") return languageName(value);
  if (type === "engine") return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

function toBarData(rows: BenchmarkCell[]): BarDatum[] {
  return rows.map((r) => ({
    name: labelForDimensionValue(r.dimension_type, r.dimension_value),
    rate: r.avg != null ? Math.round(r.avg * 1000) / 10 : null,
    total: r.brand_count,
  }));
}

function monthLabel(period: string): string {
  const [, m] = period.split("-").map(Number);
  return new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "short" });
}

export default async function BenchmarkPage() {
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <div>
        <PageHeader
          title="Benchmark Center"
          subtitle="See how your AI visibility compares to your industry — anonymously aggregated across AnsarAEO."
        />
        <div className="empty mt-6">
          <p className="text-sm text-muted">Set up a brand first to see your benchmarks.</p>
          <Link href="/dashboard/onboarding" className="btn-primary mt-5">
            Start setup
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: fullBrand } = await supabase
    .from("brands")
    .select("industry, country, industry_category")
    .eq("id", brand.id)
    .single();

  const industryCategory =
    (fullBrand?.industry_category as string) || normalizeIndustry(fullBrand?.industry ?? null);
  const region = countryToRegion(fullBrand?.country ?? null);
  const period = bucketMonth(new Date());

  // ----- anonymous benchmark cells -----
  const [industryVis, overallVis, industryMention] = await Promise.all([
    cachedBenchmark(`cell|industry|${industryCategory}|avg_visibility|${period}`, () =>
      getBenchmarkCell({ dimensionType: "industry", dimensionValue: industryCategory, metric: "avg_visibility", periodStart: period }),
    ),
    cachedBenchmark(`cell|overall|avg_visibility|${period}`, () =>
      getBenchmarkCell({ dimensionType: "overall", dimensionValue: "all", metric: "avg_visibility", periodStart: period }),
    ),
    cachedBenchmark(`cell|industry|${industryCategory}|mention_rate|${period}`, () =>
      getBenchmarkCell({ dimensionType: "industry", dimensionValue: industryCategory, metric: "mention_rate", periodStart: period }),
    ),
  ]);

  // ----- your position -----
  const [yourVis, yourMention] = await Promise.all([
    getYourPosition({ brandId: brand.id, dimensionType: "industry", dimensionValue: industryCategory, metric: "avg_visibility", periodStart: period }),
    getYourPosition({ brandId: brand.id, dimensionType: "industry", dimensionValue: industryCategory, metric: "mention_rate", periodStart: period }),
  ]);

  // ----- leaderboards / comparisons -----
  const [industryRows, regionRows, languageRows, engineRows] = await Promise.all([
    cachedBenchmark(`lead|industry|${period}`, () =>
      getLeaderboard({ dimensionType: "industry", metric: "avg_visibility", periodStart: period, limit: 10 }),
    ),
    cachedBenchmark(`lead|region|${period}`, () =>
      getLeaderboard({ dimensionType: "region", metric: "avg_visibility", periodStart: period }),
    ),
    cachedBenchmark(`lead|language|${period}`, () =>
      getLeaderboard({ dimensionType: "language", metric: "avg_visibility", periodStart: period }),
    ),
    cachedBenchmark(`lead|engine|${period}`, () =>
      getLeaderboard({ dimensionType: "engine", metric: "avg_visibility", engine: null, periodStart: period }),
    ),
  ]);

  // ----- trends -----
  const [industryTrend, brandTrend] = await Promise.all([
    cachedBenchmark(`trend|industry|${industryCategory}|${period}`, () =>
      getHistoricalTrend({ dimensionType: "industry", dimensionValue: industryCategory, metric: "avg_visibility", months: 12 }),
    ),
    cachedBenchmark(`btrend|${brand.id}|${period}`, () =>
      getBrandTrend({ brandId: brand.id, metric: "avg_visibility", months: 12 }),
    ),
  ]);

  const trendByMonth = new Map<string, { industry: number | null; you: number | null }>();
  for (const t of industryTrend.data) {
    trendByMonth.set(t.period_start, {
      industry: t.avg != null ? Math.round(t.avg * 1000) / 10 : null,
      you: null,
    });
  }
  for (const t of brandTrend.data) {
    const existing = trendByMonth.get(t.period_start) ?? { industry: null, you: null };
    existing.you = t.value != null ? Math.round(t.value * 1000) / 10 : null;
    trendByMonth.set(t.period_start, existing);
  }
  const trend = Array.from(trendByMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([m, v]) => ({ month: monthLabel(m), industry: v.industry, you: v.you }));

  const data: BenchmarkCenterData = {
    period,
    brandName: brand.name,
    industryLabel: industryLabel(industryCategory),
    regionLabel: regionLabel(region),
    industryVisibility: toCellStat(industryVis.data),
    overallVisibility: toCellStat(overallVis.data),
    yourVisibility: {
      yourValue: yourVis.yourValue,
      benchmarkAvg: yourVis.benchmarkAvg,
      benchmarkMedian: yourVis.benchmarkMedian,
      topDecile: yourVis.topDecile,
      percentile: yourVis.percentile,
      brandCount: yourVis.brandCount,
      published: yourVis.published,
    },
    yourMention: {
      yourValue: yourMention.yourValue,
      benchmarkAvg: yourMention.benchmarkAvg,
      benchmarkMedian: yourMention.benchmarkMedian,
      topDecile: yourMention.topDecile,
      percentile: yourMention.percentile,
      brandCount: yourMention.brandCount,
      published: yourMention.published,
    },
    industryLeaderboard: toBarData(industryRows.data),
    regionComparison: toBarData(regionRows.data),
    languageComparison: toBarData(languageRows.data),
    engineComparison: toBarData(engineRows.data),
    trend,
  };

  const readiness = await getReadiness("benchmark");

  return (
    <div>
      <PageHeader
        title="Benchmark Center"
        subtitle={`How ${brand.name}'s AI visibility compares to the ${industryLabel(industryCategory)} industry — anonymously aggregated across all AnsarAEO brands.`}
      />
      {readiness.available && !readiness.state.justActivated && (
        <div className="mt-6">
          <DataReadinessCard
            title="Industry Benchmarks"
            status={readiness.state.status}
            progress={readiness.state.percentage}
            confidence={readiness.state.confidence}
            requirements={readiness.state.requirements}
            estimatedCompletion={readiness.state.estimatedCompletion}
            message={readiness.state.message}
          />
        </div>
      )}
      <div className="mt-6">
        <BenchmarkCenter data={data} />
      </div>
    </div>
  );
}
