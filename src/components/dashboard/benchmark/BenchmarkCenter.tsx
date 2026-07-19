"use client";

import { ComparisonBar, BenchmarkComparisonLine } from "@/components/dashboard/charts";

export type CellStat = {
  avg: number | null;
  p50: number | null;
  p90: number | null;
  brandCount: number;
  published: boolean;
};

export type YourStat = {
  yourValue: number | null;
  benchmarkAvg: number | null;
  benchmarkMedian: number | null;
  topDecile: number | null;
  percentile: number | null;
  brandCount: number;
  published: boolean;
};

export type BarDatum = { name: string; rate: number | null; total: number };

export type BenchmarkSeries = { month: string; industry: number | null; you: number | null };

export type BenchmarkCenterData = {
  period: string;
  brandName: string;
  industryLabel: string;
  regionLabel: string;
  industryVisibility: CellStat;
  overallVisibility: CellStat;
  yourVisibility: YourStat;
  yourMention: YourStat;
  industryLeaderboard: BarDatum[];
  regionComparison: BarDatum[];
  languageComparison: BarDatum[];
  engineComparison: BarDatum[];
  trend: BenchmarkSeries[];
};

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 10) / 10}%`;
}

function StatCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ? "text-[#D66A38]" : "text-ink"}`}>{value}</p>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

function Insufficient() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/60 p-5">
      <p className="text-sm text-muted">
        Not enough brands benchmarked in this segment yet (needs at least 5 brands to protect
        anonymity). Check back as more of the industry onboards.
      </p>
    </div>
  );
}

export default function BenchmarkCenter({ data }: { data: BenchmarkCenterData }) {
  const ind = data.industryVisibility;
  const overall = data.overallVisibility;
  const you = data.yourVisibility;

  const inTopDecile = you.published && you.yourValue != null && you.topDecile != null && you.yourValue >= you.topDecile;
  const percentileBadge =
    you.published && you.percentile != null
      ? `Top ${Math.max(1, Math.round(100 - you.percentile))}%`
      : null;

  return (
    <div className="space-y-6">
      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ind.published ? (
          <StatCard
            title={`${data.industryLabel} avg visibility`}
            value={pct(ind.avg)}
            sub={`${ind.brandCount} brands · this month`}
          />
        ) : (
          <Insufficient />
        )}
        {overall.published ? (
          <StatCard
            title="All-industry avg visibility"
            value={pct(overall.avg)}
            sub={`${overall.brandCount} brands`}
          />
        ) : (
          <Insufficient />
        )}
        {you.published ? (
          <StatCard
            title="Your visibility"
            value={pct(you.yourValue)}
            sub={percentileBadge ? `${percentileBadge} vs ${data.industryLabel}` : "vs industry"}
            accent
          />
        ) : (
          <Insufficient />
        )}
        {ind.published ? (
          <StatCard
            title="Top 10% threshold"
            value={pct(ind.p90)}
            sub={inTopDecile ? "You're in the top 10% 🎉" : "visibility rate of the top decile"}
          />
        ) : (
          <Insufficient />
        )}
      </div>

      {/* Historical comparison */}
      <section className="rounded-xl border border-line bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-ink">Historical comparison</h2>
          <span className="text-xs text-muted">
            {data.industryLabel} vs your brand · last 12 months
          </span>
        </div>
        <BenchmarkComparisonLine data={data.trend} />
      </section>

      {/* Leaderboard + comparisons */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Industry leaderboard</h2>
          <ComparisonBar data={data.industryLeaderboard} label="AI visibility" />
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Regional comparison</h2>
          <ComparisonBar data={data.regionComparison} label="AI visibility" />
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Language comparison</h2>
          <ComparisonBar data={data.languageComparison} label="AI visibility" />
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">AI engine comparison</h2>
          <ComparisonBar data={data.engineComparison} label="AI visibility" />
        </section>
      </div>

      {/* Your mention position */}
      {data.yourMention.published ? (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-1 text-base font-semibold text-ink">Your AI recommendation rate</h2>
          <p className="text-sm text-muted">
            You are recommended in <span className="font-semibold text-ink">{pct(data.yourMention.yourValue)}</span>{" "}
            of AI answers, vs the {data.industryLabel} average of{" "}
            <span className="font-semibold text-ink">{pct(data.yourMention.benchmarkAvg)}</span>.
          </p>
        </section>
      ) : null}
    </div>
  );
}
