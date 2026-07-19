import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { listMissions, listTasks, listOpportunities } from "@/lib/workflow";
import { logActivationEvent } from "@/lib/activation-events";
import { NextScanCountdown } from "@/components/dashboard/NextScanCountdown";
import { Panel } from "@/components/dashboard/panel";
import OpportunityQueue from "@/components/dashboard/workflow/OpportunityQueue";
import {
  ActivityFeed,
  AIHealth,
  CompetitorRadar,
  ExecutiveRow,
  MissionHeader,
  QuickActions,
  RecentWins,
  TodaysMission,
  TrendWidget,
  WeeklyProgress,
  type FeedEntry,
  type RadarRow,
  type HealthStatus,
} from "@/components/dashboard/mission-control/widgets";
import { QuickActionsBridge } from "@/components/dashboard/mission-control/widgets.client";
import ActivityFeedLive from "@/components/dashboard/mission-control/ActivityFeedLive";

export const dynamic = "force-dynamic";

// ============================================================
// /dashboard/b/[slug] — Mission Control (Phase 2 URL-scoped).
//
// Same widget stack as before; only the brand-resolution source
// changed: URL slug instead of cookie. Copied from the old
// /dashboard/page.tsx; the old path is now a redirect stub.
// ============================================================

export default async function MissionControlHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  // Welcome gate — same as before.
  const svc = createServiceClient();
  const { data: welcomed } = await svc
    .from("activation_events")
    .select("id")
    .eq("user_id", user.id)
    .eq("event", "welcomed")
    .limit(1);
  if (!welcomed?.length) redirect("/dashboard/welcome");

  // ---------- Prompts first (needed to scope run queries) ----------
  const { data: prompts = [] } = await supabase
    .from("prompts")
    .select("id, priority")
    .eq("brand_id", brand.id);
  const promptIds = (prompts ?? []).map((p) => p.id);
  const priorityIds = new Set((prompts ?? []).filter((p) => p.priority).map((p) => p.id));

  // ---------- Parallel fetch for everything else ----------
  const [missions, tasks, opportunities, enginesRes, firingsRes, competitorsCountRes, lastScanRes] =
    await Promise.all([
      listMissions(brand.id, { status: "active" }, supabase),
      listTasks({ brand_id: brand.id }, supabase),
      listOpportunities(brand.id, { status: "open" }, supabase),
      supabase.from("engines").select("id, name, is_active").eq("is_active", true),
      supabase
        .from("geo_alert_firings")
        .select("id, metric, metric_value, previous_value, threshold, fired_at")
        .eq("brand_id", brand.id)
        .order("fired_at", { ascending: false })
        .limit(5),
      supabase.from("competitors").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
      promptIds.length
        ? supabase
            .from("visibility_runs")
            .select("run_at")
            .in("prompt_id", promptIds)
            .order("run_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] as { run_at: string }[] }),
    ]);

  const engines = enginesRes.data ?? [];
  const firings = firingsRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _competitorsCount = competitorsCountRes.count ?? 0;
  const lastScanAt = lastScanRes.data?.[0]?.run_at ?? null;

  // Runs — used for KPIs, trend, and radar.
  const { data: runs } = promptIds.length
    ? await supabase
        .from("visibility_runs")
        .select("id, prompt_id, run_at, brand_mentioned, competitor_mentions")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(2000)
    : { data: [] };
  const allRuns = (runs ?? []) as {
    id: string;
    prompt_id: string;
    run_at: string;
    brand_mentioned: boolean;
    competitor_mentions: unknown;
  }[];

  // ---------- KPI computations ----------
  const now = Date.now();
  const day = 86_400_000;
  const cur7 = allRuns.filter((r) => now - new Date(r.run_at).getTime() < 7 * day);
  const prev7 = allRuns.filter((r) => {
    const t = now - new Date(r.run_at).getTime();
    return t >= 7 * day && t < 14 * day;
  });

  const visRateCur = rateOf(cur7);
  const visRatePrev = rateOf(prev7);
  const visibilityDelta = visRateCur != null && visRatePrev != null ? Math.round(visRateCur - visRatePrev) : null;

  // Citation share — own / (own + competitor + third-party).
  const runIds = allRuns.slice(0, 500).map((r) => r.id);
  let citationShare: number | null = null;
  if (runIds.length) {
    const { data: cits } = await supabase
      .from("citations")
      .select("is_own_domain, is_competitor_domain")
      .in("run_id", runIds);
    const own = (cits ?? []).filter((c) => c.is_own_domain).length;
    const total = (cits ?? []).length;
    citationShare = total > 0 ? Math.round((own / total) * 100) : null;
  }

  // Shortlist share — visibility rate on priority prompts only.
  const priorityRuns = cur7.filter((r) => priorityIds.has(r.prompt_id));
  const shortlistShare = priorityIds.size > 0 ? rateOf(priorityRuns) : null;

  // AI revenue — Phase 1 leaves this at "not connected" unless the outcome
  // library returns a value. The full outcome layer already handles this at
  // /dashboard/b/[slug]/visibility — Mission Control just previews.
  const aiRevenue: number | null = null;
  const revenueConnected = false;

  // ---------- Today's Mission — highest priority open opp ----------
  const todaysMissionCandidate = opportunities
    .filter((o) => o.status === "open")
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))[0] ?? null;
  const remainingOpportunities = opportunities.filter((o) => o.id !== todaysMissionCandidate?.id).slice(0, 5);

  // ---------- Competitor Radar — top 5 moves by |delta| ----------
  const radar = buildRadar(cur7, prev7);

  // ---------- Activity feed — synthesized from real sources ----------
  const feed = buildFeed({
    firings,
    lastScanAt,
    completedMissions: tasks.filter((t) => t.status === "done").slice(0, 5),
    brandSlug: slug,
  });

  // ---------- Recent wins — completed missions with a measurable outcome ----------
  const doneMissions = missions.filter((m) => m.status === "completed");
  const wins = doneMissions.slice(0, 5).map((m) => ({
    id: m.id,
    title: m.title,
    result: "Mission closed",
    at: m.updated_at,
  }));

  // ---------- AI Health ----------
  const health = deriveHealth({
    lastScanAt,
    firings,
    activeEngines: engines.length,
  });

  // ---------- Trend (30d) ----------
  const trend = buildTrend(allRuns);

  // ---------- Weekly progress ----------
  const missionsThisWeek = missions.filter(
    (m) => now - new Date(m.updated_at).getTime() < 7 * day && m.status === "completed",
  ).length;
  const missionsGoal = Math.max(3, Math.ceil(opportunities.length / 4)); // aspirational, not enforced

  // Log return-visit activation event (idempotent — same as before).
  await logActivationEvent({
    event: "welcomed",
    userId: user.id,
    brandId: brand.id,
    payload: { revisit: true },
  });

  return (
    <div>
      <QuickActionsBridge />

      <MissionHeader
        brandName={brand.name || "Your brand"}
        brandSlug={slug}
        industry={brand.industry ?? null}
        lastScanAt={lastScanAt}
      />

      <div className="mb-6">
        <ExecutiveRow
          brandSlug={slug}
          visibilityRate={visRateCur}
          visibilityDelta={visibilityDelta}
          citationShare={citationShare}
          shortlistShare={shortlistShare}
          aiRevenue={aiRevenue}
          revenueConnected={revenueConnected}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr,auto]">
        <TodaysMission brandSlug={slug} brandId={brand.id} opportunity={todaysMissionCandidate} />
        <NextScanCountdown />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <OpportunitiesWidget
          items={remainingOpportunities.map((o) => ({
            id: o.id,
            type: o.type,
            title: o.title,
            estimated_impact: o.estimated_impact,
            priority_score: o.priority_score,
          }))}
        />
        <CompetitorRadar brandSlug={slug} rows={radar} />
      </div>

      <div className="mb-6">
        {/* Server render provides the full styled Activity panel with the
            initial entries; the Live wrapper below appends new events as
            SSE frames arrive from /api/feed/stream. If a browser blocks
            EventSource, the static server render still stands on its own. */}
        <ActivityFeed brandSlug={slug} entries={feed} />
        <ActivityFeedLive brandId={brand.id} brandSlug={slug} initialEntries={feed.slice(0, 0)} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <RecentWinsOrEmpty wins={wins} newBrand={allRuns.length === 0} />
        <AIHealth status={health.status} message={health.message} fixHref={health.fixHref} />
        <TrendWidget brandSlug={slug} data={trend} />
      </div>

      <div className="mb-6">
        <WeeklyProgress
          missionsDone={missionsThisWeek}
          missionsGoal={missionsGoal}
          opportunitiesAccepted={opportunities.filter((o) => o.status === "acknowledged").length}
          opportunitiesSurfaced={opportunities.length}
          auditPassing={0}
          auditTotal={0}
        />
      </div>

      <QuickActions brandSlug={slug} />

      <p className="mt-6 text-center text-xs text-muted">
        Press{" "}
        <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-semibold">⌘K</kbd>{" "}
        to search or run any action. Press{" "}
        <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-semibold">?</kbd>{" "}
        for shortcuts.
      </p>

      <div className="mt-4 flex justify-center gap-4 text-xs">
        <span className="text-muted">Missions:</span>
        <Link href={`/dashboard/b/${slug}/tasks`} className="font-medium text-accent">Task board →</Link>
        <span className="text-muted">·</span>
        <Link href={`/dashboard/b/${slug}/opportunities`} className="font-medium text-accent">Full queue →</Link>
      </div>
    </div>
  );
}

// ---------- Widget wrappers that only make sense inside this page ----------

function OpportunitiesWidget({
  items,
}: {
  items: {
    id: string;
    type: string;
    title: string;
    estimated_impact: Record<string, unknown> | null;
    priority_score: number | null;
  }[];
}) {
  return (
    <Panel
      title="Opportunities"
      description="Ranked by business value — accept to spin up a mission"
      action={
        <Link href="/dashboard/opportunities" className="text-xs font-medium text-accent">
          View all →
        </Link>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing else queued right now. Your next scan will surface fresh gaps overnight.
        </p>
      ) : (
        <OpportunityQueue
          opportunities={items.map((o) => ({
            id: o.id,
            type: o.type,
            title: o.title,
            estimated_impact: o.estimated_impact,
            priority_score: o.priority_score,
            status: "open",
          }))}
        />
      )}
    </Panel>
  );
}

function RecentWinsOrEmpty({
  wins,
  newBrand,
}: {
  wins: { id: string; title: string; result: string; at: string }[];
  newBrand: boolean;
}) {
  if (wins.length > 0) return <RecentWins wins={wins} />;
  return (
    <Panel title="Recent wins" description={newBrand ? "Wins land here when you complete a mission" : "Nothing closed recently"}>
      <p className="text-sm text-muted">
        {newBrand
          ? "Your first scan is priming the queue — accept an opportunity to record a win."
          : "Complete an accepted mission to celebrate progress here."}
      </p>
    </Panel>
  );
}

// ---------- Pure helpers ----------

function rateOf(runs: { brand_mentioned: boolean }[]): number | null {
  if (runs.length === 0) return null;
  const mentioned = runs.filter((r) => r.brand_mentioned).length;
  return Math.round((mentioned / runs.length) * 100);
}

function buildRadar(
  cur: { competitor_mentions: unknown }[],
  prev: { competitor_mentions: unknown }[],
): RadarRow[] {
  function tally(list: { competitor_mentions: unknown }[]) {
    const t = new Map<string, number>();
    for (const r of list) {
      const arr = Array.isArray(r.competitor_mentions) ? r.competitor_mentions : [];
      for (const c of arr as { name?: string; mentioned?: boolean }[]) {
        if (c?.mentioned && c.name) t.set(c.name, (t.get(c.name) ?? 0) + 1);
      }
    }
    return t;
  }
  const cTally = tally(cur);
  const pTally = tally(prev);
  const denom = Math.max(cur.length, 1);
  const pDenom = Math.max(prev.length, 1);
  const names = new Set<string>([...cTally.keys(), ...pTally.keys()]);
  const rows: RadarRow[] = [];
  for (const name of names) {
    const curPct = ((cTally.get(name) ?? 0) / denom) * 100;
    const prevPct = ((pTally.get(name) ?? 0) / pDenom) * 100;
    const delta = Math.round(curPct - prevPct);
    if (delta === 0 && (cTally.get(name) ?? 0) < 2) continue;
    rows.push({ competitor: name, deltaPp: delta });
  }
  return rows.sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp)).slice(0, 5);
}

function buildFeed({
  firings,
  lastScanAt,
  completedMissions,
  brandSlug,
}: {
  firings: { id: string; metric: string; metric_value: number | null; threshold: number; fired_at: string }[];
  lastScanAt: string | null;
  completedMissions: { id: string; title: string; completed_at: string | null }[];
  brandSlug: string;
}): FeedEntry[] {
  const feed: FeedEntry[] = [];
  if (lastScanAt) {
    feed.push({
      id: `scan-${lastScanAt}`,
      kind: "scan.completed",
      message: "Fresh scan completed",
      detail: "Visibility, citations, and opportunities were recomputed",
      at: lastScanAt,
      href: `/dashboard/b/${brandSlug}/visibility`,
    });
  }
  for (const f of firings) {
    feed.push({
      id: `alert-${f.id}`,
      kind: "alert.fired",
      message: `Alert: ${f.metric} crossed threshold`,
      detail: `Value ${f.metric_value ?? "n/a"} · threshold ${f.threshold}`,
      href: "/dashboard/alerts",
      at: f.fired_at,
    });
  }
  for (const t of completedMissions) {
    if (!t.completed_at) continue;
    feed.push({
      id: `task-${t.id}`,
      kind: "task.completed",
      message: `Task completed: ${t.title}`,
      href: "/dashboard/tasks",
      at: t.completed_at,
    });
  }
  return feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 20);
}

function buildTrend(runs: { run_at: string; brand_mentioned: boolean }[]): { date: string; score: number }[] {
  const cutoff = Date.now() - 30 * 86_400_000;
  const byDay = new Map<string, { total: number; hit: number; day: number }>();
  for (const r of runs) {
    const t = new Date(r.run_at).getTime();
    if (t < cutoff) continue;
    const d = new Date(r.run_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = byDay.get(key) ?? { total: 0, hit: 0, day: t };
    entry.total += 1;
    if (r.brand_mentioned) entry.hit += 1;
    byDay.set(key, entry);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => a[1].day - b[1].day)
    .map(([, v]) => ({
      date: new Date(v.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      score: v.total ? Math.round((v.hit / v.total) * 100) : 0,
    }));
}

function deriveHealth({
  lastScanAt,
  firings,
  activeEngines,
}: {
  lastScanAt: string | null;
  firings: { fired_at: string }[];
  activeEngines: number;
}): { status: HealthStatus; message: string; fixHref?: string } {
  if (activeEngines === 0) {
    return {
      status: "critical",
      message: "No active AI engines. Enable at least one in integrations to start scanning.",
      fixHref: "/dashboard/settings/integrations",
    };
  }
  if (!lastScanAt) {
    return { status: "attention", message: "No scans yet. Run one to hydrate this workspace." };
  }
  const scanAge = Date.now() - new Date(lastScanAt).getTime();
  if (scanAge > 2 * 86_400_000) {
    return {
      status: "attention",
      message: "Last scan was more than 48 hours ago — the nightly cron may be stalled.",
      fixHref: "/dashboard/settings/integrations",
    };
  }
  const recentAlerts = firings.filter((f) => Date.now() - new Date(f.fired_at).getTime() < 86_400_000);
  if (recentAlerts.length >= 2) {
    return {
      status: "attention",
      message: `${recentAlerts.length} alerts fired in the last 24h — review before they escalate.`,
      fixHref: "/dashboard/alerts",
    };
  }
  return { status: "healthy", message: "Engines reporting, cron on schedule, no critical alerts." };
}
