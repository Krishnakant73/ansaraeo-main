import Link from "next/link";
import { Activity, Eye, Link2, MessageSquare, Target, TrendingUp, ThumbsUp, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { computeGeoMetrics, splitWindows, type GeoRun, type GeoCitation, type EngineInfo } from "@/lib/geo-metrics";
import { getRevenueOutcome } from "@/lib/outcome";
import { getCompetitorWinReasons } from "@/lib/competitor-intel";
import { INTENTS, intentLabel, type IntentKey } from "@/lib/intent";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import { VisibilityArea, EngineBar, SentimentDonut } from "@/components/dashboard/charts";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";
import { FirstRunCTA } from "@/components/dashboard/FirstRunCTA";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Eye className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Let&apos;s set up your first brand</h1>
        <p className="mt-2 text-sm text-muted">
          Takes about a minute — we&apos;ll auto-generate starter prompts for you.
        </p>
        <Link href="/dashboard/onboarding" className="btn-primary mt-6">
          Start setup
        </Link>
      </div>
    );
  }

  const readiness = await getReadiness("mission-control", { brandId: brand.id });

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, language, intent, priority")
    .eq("brand_id", brand.id);
  const promptIds = (prompts ?? []).map((p) => p.id);
  const priorityPromptIds = new Set(
    (prompts ?? []).filter((p) => p.priority).map((p) => p.id),
  );

  const { data: engines } = await supabase.from("engines").select("id, name").eq("is_active", true);
  const engineName = new Map<string, string>((engines ?? []).map((e) => [e.id, e.name]));

  const { data: runsData } = promptIds.length
    ? await supabase
        .from("visibility_runs")
        .select("id, prompt_id, engine_id, run_at, brand_mentioned, brand_position, sentiment, recommendation_alignment")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: true })
    : { data: null };
  const runs = (runsData ?? []) as GeoRun[];

  const runIds = runs.map((r) => r.id);
  const { data: citationsData } = runIds.length
    ? await supabase
        .from("citations")
        .select("id, run_id, cited_domain, cited_url, is_own_domain, is_competitor_domain, is_trusted_source")
        .in("run_id", runIds)
    : { data: null };
  const citations = (citationsData ?? []) as GeoCitation[];

  const promptIntent: Record<string, IntentKey | null> = {};
  for (const p of prompts ?? []) promptIntent[p.id] = (p.intent as IntentKey) || null;
  const engineList = (engines ?? []) as EngineInfo[];

  // Headline metrics over the current 7-day window, with the prior 7 days used
  // for trend velocity. If there are no runs in the last 7 days, fall back to
  // all recorded runs (trend velocity then reads null — honest, not estimated).
  const { current, prior } = splitWindows(runs, 7);
  const effectiveCurrent = current.length > 0 ? current : runs;
  const effectivePrior = current.length > 0 ? prior : [];
  const metrics = computeGeoMetrics({
    runs: effectiveCurrent,
    citations,
    engines: engineList,
    promptIntent,
    priorRuns: effectivePrior,
  });

  // --- Shortlist share: metrics over the brand's flagged "money prompts" only ---
  const priorityRuns = runs.filter((r) => priorityPromptIds.has(r.prompt_id));
  const priorityRunIds = new Set(priorityRuns.map((r) => r.id));
  const priorityCitations = citations.filter((c) => priorityRunIds.has(c.run_id));
  const priorityIntent: Record<string, IntentKey | null> = {};
  for (const p of prompts ?? []) if (p.priority) priorityIntent[p.id] = (p.intent as IntentKey) || null;
  const priorityMetrics =
    priorityPromptIds.size > 0
      ? computeGeoMetrics({
          runs: priorityRuns,
          citations: priorityCitations,
          engines: engineList,
          promptIntent: priorityIntent,
          priorRuns: [],
        })
      : null;

  // --- Daily visibility trend (all recorded runs) ---
  const runsByDay = new Map<string, { total: number; mentioned: number }>();
  for (const run of runs) {
    const day = new Date(run.run_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    if (!runsByDay.has(day)) runsByDay.set(day, { total: 0, mentioned: 0 });
    const e = runsByDay.get(day)!;
    e.total += 1;
    if (run.brand_mentioned) e.mentioned += 1;
  }
  const trendData = Array.from(runsByDay.entries()).map(([date, { total, mentioned }]) => ({
    date,
    score: total ? Math.round((mentioned / total) * 100) : 0,
  }));

  // --- Sentiment mix (current window) ---
  const sent = { positive: 0, neutral: 0, negative: 0 };
  for (const r of effectiveCurrent) {
    const s = (r.sentiment || "neutral").toLowerCase();
    if (s.includes("pos")) sent.positive += 1;
    else if (s.includes("neg")) sent.negative += 1;
    else sent.neutral += 1;
  }
  const sentimentData = [
    { name: "Positive", value: sent.positive, color: "#10B981" },
    { name: "Neutral", value: sent.neutral, color: "#9CA3AF" },
    { name: "Negative", value: sent.negative, color: "#F43F5E" },
  ];

  // --- Model divergence: per-engine visibility rate ---
  const engineCounts = new Map<string, number>();
  for (const r of effectiveCurrent) {
    const name = (r.engine_id && engineName.get(r.engine_id)) || "Other";
    engineCounts.set(name, (engineCounts.get(name) ?? 0) + 1);
  }
  const engineData = Object.entries(metrics.per_engine)
    .map(([name, m]) => ({ name, rate: m.visibility_rate ?? 0, total: engineCounts.get(name) ?? 0 }))
    .sort((a, b) => b.rate - a.rate);

  // --- Citation share donut (current window) ---
  const citationShareData = [
    { name: "Own domain", value: metrics.totals.own_citations, color: "#D66A38" },
    { name: "Competitor", value: metrics.totals.competitor_citations, color: "#6B7280" },
    { name: "Third-party", value: metrics.totals.third_party_citations, color: "#9CA3AF" },
  ];

  // --- Competitor "why they win" ---
  let winReasons: { competitor: string; promptText: string; reason: string }[] = [];
  try {
    const reasons = await getCompetitorWinReasons(supabase, brand.id);
    winReasons = reasons.slice(0, 8).map((r) => ({
      competitor: r.competitor,
      promptText: r.promptText,
      reason: r.reason,
    }));
  } catch {
    winReasons = [];
  }

  // --- Business outcome (only when GA4/Shopify connected) ---
  let outcome: Awaited<ReturnType<typeof getRevenueOutcome>> | null = null;
  try {
    outcome = await getRevenueOutcome(brand.id, supabase);
  } catch {
    outcome = null;
  }

  // --- Recent alert firings (from the nightly alert evaluation) ---
  let firings: {
    id: string;
    metric: string;
    metric_value: number | null;
    previous_value: number | null;
    threshold: number;
    fired_at: string;
  }[] = [];
  try {
    const { data: fData } = await supabase
      .from("geo_alert_firings")
      .select("id, metric, metric_value, previous_value, threshold, fired_at")
      .eq("brand_id", brand.id)
      .order("fired_at", { ascending: false })
      .limit(5);
    firings = (fData ?? []) as typeof firings;
  } catch {
    firings = [];
  }

  const pctLabel = (v: number | null) => (v === null ? "—" : `${v}%`);

  return (
    <div>
      {runs.length === 0 && <FirstRunCTA promptIds={promptIds} />}

      <PageHeader
        title={brand.name}
        subtitle={brand.industry ?? "AI search visibility"}
        actions={
          <>
            <Link href="/dashboard/competitors" className="btn-secondary !h-10 !px-5">
              Competitors
            </Link>
            <Link href="/dashboard/prompts" className="btn-primary !h-10 !px-5">
              Manage prompts
            </Link>
          </>
        }
      />

      {readiness.available && !readiness.state.justActivated && (
        <div className="mb-6">
          <DataReadinessCard
            title="Mission Control"
            status={readiness.state.status}
            progress={readiness.state.percentage}
            confidence={readiness.state.confidence}
            requirements={readiness.state.requirements}
            estimatedCompletion={readiness.state.estimatedCompletion}
            message={readiness.state.message}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Visibility score"
          value={pctLabel(metrics.visibility_rate)}
          delta={metrics.trend_velocity ?? undefined}
          deltaLabel="vs prev 7d"
          icon={<Eye className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Citation rate"
          value={pctLabel(metrics.citation_rate)}
          icon={<Link2 className="h-4 w-4" />}
          hint="cited, not just mentioned"
        />
        <StatCard
          label="Citation share"
          value={pctLabel(metrics.citation_share)}
          icon={<Link2 className="h-4 w-4" />}
          hint="of all citations"
        />
        <StatCard
          label="Avg rank"
          value={metrics.avg_rank ?? "—"}
          icon={<BarChart3 className="h-4 w-4" />}
          hint="when mentioned"
        />
        <StatCard
          label="Model divergence"
          value={metrics.model_divergence ?? "—"}
          icon={<Activity className="h-4 w-4" />}
          hint="engine disagreement"
        />
        <StatCard
          label="Recommendation quality"
          value={pctLabel(metrics.recommendation_quality)}
          icon={<ThumbsUp className="h-4 w-4" />}
          hint="correctly recommended"
        />
        <StatCard
          label="Sentiment score"
          value={pctLabel(metrics.sentiment_score)}
          icon={<TrendingUp className="h-4 w-4" />}
          hint="tone of mentions"
        />
        <StatCard
          label="Tracked prompts"
          value={prompts?.length ?? 0}
          icon={<MessageSquare className="h-4 w-4" />}
          hint="across engines"
        />
        <StatCard
          label="Shortlist share"
          value={pctLabel(priorityMetrics?.visibility_rate ?? null)}
          icon={<Target className="h-4 w-4" />}
          hint={
            priorityPromptIds.size === 0
              ? "star money prompts"
              : `on ${priorityPromptIds.size} priority prompt${priorityPromptIds.size === 1 ? "" : "s"}`
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Visibility trend"
          description="Daily mention rate across tracked prompts"
        >
          <VisibilityArea data={trendData} />
        </Panel>
        <Panel title="Sentiment mix" description="Tone of brand mentions">
          <SentimentDonut data={sentimentData} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Model divergence"
          description="Mention rate by engine — the bigger the spread, the more engines disagree about your brand"
        >
          <EngineBar data={engineData} />
        </Panel>
        <Panel title="Citation share" description="Own vs competitor vs third-party citations">
          <SentimentDonut data={citationShareData} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Why competitors win"
          description="Per-prompt reasons a competitor beats you (real runs only)"
        >
          {winReasons.length === 0 ? (
            <p className="text-sm text-muted">No competitor wins recorded yet — add confirmed competitors to start tracking.</p>
          ) : (
            <ul className="space-y-3">
              {winReasons.map((w, i) => (
                <li key={i} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{w.competitor}</span>
                    <span className="text-muted"> — “{w.promptText}”</span>
                  </span>
                  <span className="chip shrink-0">{w.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="By intent" description="Visibility across funnel stages">
          {Object.keys(metrics.by_intent).length === 0 ? (
            <p className="text-sm text-muted">Tag prompts with an intent to see funnel-stage breakdown.</p>
          ) : (
            <ul className="space-y-3">
              {INTENTS.filter((i) => metrics.by_intent[i.key]).map((i) => {
                const m = metrics.by_intent[i.key];
                return (
                  <li key={i.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 text-muted" />
                      {i.label}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted">vis {pctLabel(m.visibility_rate)}</span>
                      <span className="font-semibold text-ink">cite {pctLabel(m.citation_rate)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="AI-driven revenue" description="Outcome layer — only shown when GA4 / Shopify are connected">
          {outcome?.connected ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="AI-referral sessions (30d)" value={outcome.aiSessions ?? "—"} icon={<Eye className="h-4 w-4" />} />
              <StatCard
                label="Assisted revenue (30d)"
                value={outcome.assistedRevenue === null ? "—" : `₹${Math.round(outcome.assistedRevenue).toLocaleString("en-IN")}`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard label="Attributed orders (30d)" value={outcome.orders ?? "—"} icon={<Activity className="h-4 w-4" />} />
            </div>
          ) : (
            <EmptyState
              title="Connect GA4 & Shopify"
              description="Link your brand's own analytics and store to see AI-search assisted revenue on this dashboard."
              action={
                <Link href="/dashboard/settings/integrations" className="btn-primary !h-10 !px-5">
                  Connect integrations
                </Link>
              }
            />
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Recent alerts" description="Triggered by the nightly rule evaluation — manage them in Alerts">
          {firings.length === 0 ? (
            <p className="text-sm text-muted">
              No alerts fired yet.{" "}
              <Link href="/dashboard/alerts" className="text-accent underline">
                Set up rules
              </Link>{" "}
              to get notified on drops or spikes.
            </p>
          ) : (
            <ul className="space-y-2">
              {firings.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold text-ink">{f.metric}</span>{" "}
                    <span className="text-muted">
                      {f.metric_value ?? "—"}
                      {f.previous_value != null ? ` (was ${f.previous_value})` : ""} · threshold {f.threshold}
                    </span>
                  </span>
                  <span className="text-xs text-muted">{new Date(f.fired_at).toLocaleDateString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
