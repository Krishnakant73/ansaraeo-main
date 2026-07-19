// ============================================================
// Public Intelligence Portal  (the public face of the moat)
//
// Server component, NO auth. Reads ONLY published, k-anon-safe rows via the
// service client. Never selects brand_id or raw text. Brand identities are
// shown only as anonymous ranking tokens; the graph view is restricted to
// non-PII node types (source domains, topics).
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

const INDUSTRIES = ["saas", "fintech", "ecommerce", "healthcare", "education", "d2c"];

export default async function PublicIntelligencePage() {
  const svc = createServiceClient();

  const [{ data: index }, { data: rankings }, { data: feed }, { data: graph }] = await Promise.all([
    svc
      .from("benchmark_aggregates")
      .select("dimension_value, avg, brand_count")
      .eq("dimension_type", "industry")
      .eq("engine", "*")
      .eq("metric", "avg_visibility")
      .eq("published", true)
      .order("avg", { ascending: false })
      .limit(12),
    svc
      .from("rankings_monthly")
      .select("brand_token, value, rank")
      .eq("dimension_type", "industry")
      .eq("dimension_value", "saas")
      .eq("rank_metric", "mention_rate")
      .eq("published", true)
      .order("rank", { ascending: true })
      .limit(20),
    svc
      .from("intelligence_feed_events")
      .select("*")
      .eq("scope", "global")
      .eq("published", true)
      .order("occurred_at", { ascending: false })
      .limit(12),
    svc
      .from("graph_metrics")
      .select("entity_type, entity_key, pagerank, in_degree")
      .in("entity_type", ["source", "topic"])
      .order("pagerank", { ascending: false })
      .limit(15),
  ]);

  const { data: trendCells } = await svc
    .from("benchmark_trend_cells")
    .select("*")
    .eq("change_point", true)
    .order("period_start", { ascending: false })
    .limit(10);

  const idx = (index as any[] | null) ?? [];
  const leaderboard = (rankings as any[] | null) ?? [];
  const changePoints = (trendCells as any[] | null) ?? [];
  const feedItems = (feed as any[] | null) ?? [];
  const graphNodes = (graph as any[] | null) ?? [];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          The AI Discovery Intelligence Network
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-500">
          Anonymous, cross-brand intelligence on how AI engines discover, recommend, and cite businesses. Updated monthly from millions of real recommendation checks.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">AI Discovery Index by industry</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {idx.map((r: any) => (
            <div key={r.dimension_value} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm text-zinc-600 dark:text-zinc-300">{r.dimension_value}</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{pct(r.avg)}</div>
              <div className="mt-1 text-xs text-zinc-400">{r.brand_count} brands</div>
            </div>
          ))}
          {idx.length === 0 && <p className="text-sm text-zinc-400">Gathering data — publish thresholds not yet met for all industries.</p>}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">SaaS mention-share leaderboard (anonymous)</h2>
          <ol className="space-y-1 text-sm">
            {leaderboard.map((r: any) => (
              <li key={r.brand_token} className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">{String(r.brand_token).slice(0, 8)}…</span>
                <span className="text-zinc-700 dark:text-zinc-200">{pct(r.value)}</span>
              </li>
            ))}
            {leaderboard.length === 0 && <p className="text-sm text-zinc-400">Not enough SaaS brands to publish yet (k≥5).</p>}
          </ol>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Trending shifts</h2>
          <ul className="space-y-2 text-sm">
            {changePoints.map((t: any, i: number) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-zinc-700 dark:text-zinc-200">
                  {t.dimension_value} · {t.metric}
                </span>
                <span className={`text-xs ${t.trend_direction === "up" ? "text-emerald-600" : t.trend_direction === "down" ? "text-rose-600" : "text-zinc-400"}`}>
                  {t.trend_direction} {((t.delta ?? 0) * 100).toFixed(1)}pp
                </span>
              </li>
            ))}
            {changePoints.length === 0 && <p className="text-sm text-zinc-400">No significant shifts this period.</p>}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Most-cited sources (graph authority)</h2>
          <ul className="space-y-1 text-sm">
            {graphNodes
              .filter((n: any) => n.entity_type === "source")
              .map((n: any) => (
                <li key={n.entity_key} className="flex items-center justify-between">
                  <span className="text-zinc-700 dark:text-zinc-200">{n.entity_key}</span>
                  <span className="text-xs text-zinc-400">{(n.pagerank * 1000).toFixed(2)}</span>
                </li>
              ))}
            {graphNodes.length === 0 && <p className="text-sm text-zinc-400">Graph building…</p>}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Intelligence feed</h2>
          <ul className="space-y-3">
            {feedItems.map((f: any) => (
              <li key={f.id} className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800">
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{f.title}</div>
                {f.body && <div className="mt-0.5 text-xs text-zinc-500">{f.body}</div>}
              </li>
            ))}
            {feedItems.length === 0 && <p className="text-sm text-zinc-400">No published signals yet.</p>}
          </ul>
        </section>
      </div>

      <footer className="mt-10 text-center text-xs text-zinc-400">
        AnsarAEO Intelligence Network · all figures are anonymous and k-anonymity gated.
      </footer>
    </div>
  );
}
