// ============================================================
// /dashboard/b/[slug]/intelligence — brand's Bloomberg-terminal view.
//
// Authenticated, org-scoped. Reads the brand's own position vs the anonymous
// benchmark, its prioritized opportunities, recent trend cells, and its latest
// forecast. All brand-scoped data goes through the cookie client (RLS).
// ============================================================

import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";

export const dynamic = "force-dynamic";

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const cookie = await createClient();
  const svc = createServiceClient();

  const [{ data: own }, { data: bench }, { data: opps }, { data: trends }, { data: fc }] = await Promise.all([
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
      .select("*")
      .eq("brand_id", brand.id)
      .neq("status", "dismissed")
      .order("priority_score", { ascending: false })
      .limit(8),
    svc
      .from("benchmark_trend_cells")
      .select("*")
      .eq("dimension_type", "industry")
      .eq("dimension_value", brand.industry ?? "other")
      .eq("change_point", true)
      .order("period_start", { ascending: false })
      .limit(8),
    cookie
      .from("forecast_runs")
      .select("*")
      .eq("scope", "brand")
      .eq("brand_id", brand.id)
      .order("generated_at", { ascending: false })
      .limit(1),
  ]);

  const o: any = (own && (own as any[])[0]) || {};
  const b = new Map<string, any>((bench as any[] | null)?.map((x) => [x.metric, x]) ?? []);
  const opportunities = (opps as any[] | null) ?? [];
  const trendCells = (trends as any[] | null) ?? [];
  const forecast = (fc as any[] | null)?.[0] as any;

  const metrics: { label: string; metric: string }[] = [
    { label: "Mention rate", metric: "mention_rate" },
    { label: "Citation rate", metric: "citation_rate" },
    { label: "Trust", metric: "avg_trust" },
    { label: "Visibility", metric: "avg_visibility" },
  ];

  const readiness = await getReadiness("intelligence", { brandId: brand.id });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">AI Discovery Intelligence</h1>
        <p className="text-sm text-zinc-500">
          How {brand.name} is discovered, recommended, and cited across AI engines — versus the anonymous {brand.industry ?? "industry"} benchmark.
        </p>
      </header>

      {readiness.available && !readiness.state.justActivated && (
        <div className="mb-6">
          <DataReadinessCard
            title="AI Discovery Intelligence"
            status={readiness.state.status}
            progress={readiness.state.percentage}
            confidence={readiness.state.confidence}
            requirements={readiness.state.requirements}
            estimatedCompletion={readiness.state.estimatedCompletion}
            message={readiness.state.message}
          />
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => {
          const you = o[m.metric] as number | undefined;
          const p50 = b.get(m.metric)?.p50 as number | undefined;
          return (
            <div key={m.metric} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs uppercase tracking-wide text-zinc-400">{m.label}</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{pct(you)}</div>
              <div className="mt-1 text-xs text-zinc-500">p50 benchmark {pct(p50)}</div>
            </div>
          );
        })}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Priority opportunities</h2>
          {opportunities.length === 0 ? (
            <p className="text-sm text-zinc-400">No open gaps vs the benchmark — you&apos;re at or above p50. Keep monitoring.</p>
          ) : (
            <ul className="space-y-3">
              {opportunities.map((op: any) => (
                <li key={op.id} className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{op.title}</span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {((op.priority_score ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Est. +{op.estimated_impact?.mentions_per_month ?? 0} mentions/mo
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Recent change-points</h2>
          {trendCells.length === 0 ? (
            <p className="text-sm text-zinc-400">No 2σ shifts detected this period.</p>
          ) : (
            <ul className="space-y-2">
              {trendCells.map((t: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700 dark:text-zinc-200">
                    {t.metric} {t.trend_direction}
                  </span>
                  <span className="text-xs text-zinc-500">{((t.delta ?? 0) * 100).toFixed(1)}pp</span>
                </li>
              ))}
            </ul>
          )}
          {forecast && (
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Forecast ({forecast.metric}, {forecast.horizon_months}mo): {forecast.confidence} confidence
              {forecast.insufficient_history ? " · insufficient history" : ""}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
