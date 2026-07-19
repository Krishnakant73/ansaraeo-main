import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";
import type { Brand } from "@/lib/selected-brand";

// ============================================================
// Brand › Insights — the AI-Discovery Intelligence view.
// Compares this brand's mention/citation/trust/visibility rates
// against the anonymous industry benchmark, surfaces priority
// opportunities and change-points, plus the latest forecast.
//
// Uses the service client ONLY for benchmark_aggregates and
// benchmark_trend_cells — those are cross-org anonymized rollups
// that RLS forbids reading through the cookie client. All
// brand-scoped data (own snapshots, opportunities, forecast) goes
// through the cookie client.
// ============================================================

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

type SnapshotRow = {
  mention_rate: number | null;
  citation_rate: number | null;
  avg_trust: number | null;
  avg_visibility: number | null;
};
type BenchmarkRow = { metric: string; p50: number | null; avg: number | null };
type OppRow = {
  id: string;
  title: string;
  priority_score: number | null;
  estimated_impact: { mentions_per_month?: number } | null;
};
type TrendRow = { metric: string; trend_direction: string; delta: number | null };
type ForecastRow = {
  metric: string;
  horizon_months: number;
  confidence: string;
  insufficient_history: boolean | null;
};

export default async function InsightsBody({ brand }: { brand: Brand }) {
  const cookie = await createClient();
  const svc = createServiceClient();

  const [ownRes, benchRes, oppsRes, trendsRes, fcRes] = await Promise.all([
    cookie
      .from("benchmark_brand_snapshots")
      .select("mention_rate, citation_rate, avg_trust, avg_visibility")
      .eq("brand_id", brand.id)
      .eq("engine", "*")
      .eq("intent", "*")
      .eq("language", "*")
      .order("period_start", { ascending: false })
      .limit(1),
    svc
      .from("benchmark_aggregates")
      .select("metric, p50, avg")
      .eq("dimension_type", "industry")
      .eq("dimension_value", brand.industry ?? "other")
      .eq("engine", "*")
      .eq("published", true)
      .limit(10),
    cookie
      .from("opportunity_recommendations")
      .select("id, title, priority_score, estimated_impact")
      .eq("brand_id", brand.id)
      .neq("status", "dismissed")
      .order("priority_score", { ascending: false })
      .limit(8),
    svc
      .from("benchmark_trend_cells")
      .select("metric, trend_direction, delta")
      .eq("dimension_type", "industry")
      .eq("dimension_value", brand.industry ?? "other")
      .eq("change_point", true)
      .order("period_start", { ascending: false })
      .limit(8),
    cookie
      .from("forecast_runs")
      .select("metric, horizon_months, confidence, insufficient_history")
      .eq("scope", "brand")
      .eq("brand_id", brand.id)
      .order("generated_at", { ascending: false })
      .limit(1),
  ]);

  const own = ((ownRes.data as SnapshotRow[] | null) ?? [])[0] ?? {
    mention_rate: null,
    citation_rate: null,
    avg_trust: null,
    avg_visibility: null,
  };
  const benchByMetric = new Map<string, BenchmarkRow>(
    ((benchRes.data as BenchmarkRow[] | null) ?? []).map((x) => [x.metric, x]),
  );
  const opportunities = (oppsRes.data as OppRow[] | null) ?? [];
  const trendCells = (trendsRes.data as TrendRow[] | null) ?? [];
  const forecast = ((fcRes.data as ForecastRow[] | null) ?? [])[0];

  const metrics: { label: string; key: keyof SnapshotRow }[] = [
    { label: "Mention rate", key: "mention_rate" },
    { label: "Citation rate", key: "citation_rate" },
    { label: "Trust", key: "avg_trust" },
    { label: "Visibility", key: "avg_visibility" },
  ];

  const readiness = await getReadiness("intelligence", { brandId: brand.id });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Insights</h2>
        <p className="mt-1 text-sm text-muted">
          How {brand.name} is discovered, recommended, and cited across AI engines —
          versus the anonymous {brand.industry ?? "industry"} benchmark.
        </p>
      </div>

      {readiness.available && !readiness.state.justActivated && (
        <DataReadinessCard
          title="AI Discovery Intelligence"
          status={readiness.state.status}
          progress={readiness.state.percentage}
          confidence={readiness.state.confidence}
          requirements={readiness.state.requirements}
          estimatedCompletion={readiness.state.estimatedCompletion}
          message={readiness.state.message}
        />
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => {
          const you = own[m.key];
          const p50 = benchByMetric.get(m.key)?.p50;
          return (
            <div key={m.key} className="rounded-2xl border border-line bg-white p-4">
              <div className="section-label">{m.label}</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-ink">{pct(you)}</div>
              <div className="mt-1 text-xs text-muted">p50 benchmark {pct(p50)}</div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Priority opportunities</h3>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted">
              No open gaps vs the benchmark — you&rsquo;re at or above p50. Keep monitoring.
            </p>
          ) : (
            <ul className="space-y-3">
              {opportunities.map((op) => (
                <li key={op.id} className="border-b border-line pb-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{op.title}</span>
                    <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                      {((op.priority_score ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Est. +{op.estimated_impact?.mentions_per_month ?? 0} mentions/mo
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Recent change-points</h3>
          {trendCells.length === 0 ? (
            <p className="text-sm text-muted">No 2σ shifts detected this period.</p>
          ) : (
            <ul className="space-y-2">
              {trendCells.map((t, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    {t.metric} {t.trend_direction}
                  </span>
                  <span className="text-xs text-muted">{((t.delta ?? 0) * 100).toFixed(1)}pp</span>
                </li>
              ))}
            </ul>
          )}
          {forecast && (
            <div className="mt-4 rounded-lg bg-surface p-3 text-xs text-muted">
              Forecast ({forecast.metric}, {forecast.horizon_months}mo): {forecast.confidence} confidence
              {forecast.insufficient_history ? " · insufficient history" : ""}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
