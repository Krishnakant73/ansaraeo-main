import Link from "next/link";
import {
  LineChart, Swords, MessageSquare, Megaphone, FileDown, Trophy,
  LayoutDashboard, Sparkles, Lightbulb, PenSquare, History, Play, Bot,
  FilePlus, Share2, FileText,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { getBrandFromSlug, type Brand } from "@/lib/selected-brand";
import { createClient } from "@/lib/supabase/server";
import { listOpportunities } from "@/lib/workflow";

import VisibilityBody from "./tabs/visibility";
import CompetitorsBody from "./tabs/competitors";
import PromptsBody from "./tabs/prompts";
import CampaignsBody from "./tabs/campaigns";
import ReportsBody from "./tabs/reports";
import BenchmarkBody from "./tabs/benchmark";
import RecommendationsBody from "./tabs/recommendations";
import ContentBody from "./tabs/content";
import HistoryBody from "./tabs/history";
import InsightsBody from "./tabs/insights";
import CopilotBody from "./tabs/copilot";
import BrandWorkspaceListeners from "./BrandWorkspaceListeners.client";
import InsightCard from "@/workspace/primitives/InsightCard";

// ============================================================
// Brand workspace descriptor — Step 4 (full spec parity).
//
// This is the first workspace that fully exercises the descriptor
// contract: 10 tabs, activity, timeline, related objects, quick
// actions with keyboard bindings, and a rich Overview body sourced
// from the same data Mission Control uses. Every non-overview tab
// still has a thin-wrapper page under /dashboard/b/[slug]/<module>
// so both URL grammars keep rendering the same body.
// ============================================================

async function loadBrandKpis(brandId: string) {
  const supabase = await createClient();
  const { data: prompts = [] } = await supabase
    .from("prompts")
    .select("id, priority")
    .eq("brand_id", brandId);
  const promptIds = (prompts ?? []).map((p: { id: string }) => p.id);
  const priorityIds = new Set(
    (prompts ?? []).filter((p: { priority: boolean }) => p.priority).map((p: { id: string }) => p.id),
  );

  if (promptIds.length === 0) {
    return {
      visibilityRate: null as number | null,
      visibilityDelta: null as number | null,
      citationShare: null as number | null,
      shortlistShare: null as number | null,
      runsIn7d: 0,
    };
  }

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, prompt_id, run_at, brand_mentioned")
    .in("prompt_id", promptIds)
    .order("run_at", { ascending: false })
    .limit(2000);

  const now = Date.now();
  const day = 86_400_000;
  const cur7 = (runs ?? []).filter((r) => now - new Date(r.run_at).getTime() < 7 * day);
  const prev7 = (runs ?? []).filter((r) => {
    const t = now - new Date(r.run_at).getTime();
    return t >= 7 * day && t < 14 * day;
  });
  const rate = (rs: typeof cur7) =>
    rs.length === 0 ? null : Math.round((rs.filter((r) => r.brand_mentioned).length / rs.length) * 100);

  const visibilityRate = rate(cur7);
  const visibilityPrev = rate(prev7);
  const visibilityDelta =
    visibilityRate != null && visibilityPrev != null ? visibilityRate - visibilityPrev : null;

  const runIds = (runs ?? []).slice(0, 500).map((r) => r.id);
  let citationShare: number | null = null;
  if (runIds.length) {
    const { data: cits } = await supabase
      .from("citations")
      .select("is_own_domain")
      .in("run_id", runIds);
    const own = (cits ?? []).filter((c) => c.is_own_domain).length;
    citationShare = (cits ?? []).length > 0 ? Math.round((own / (cits ?? []).length) * 100) : null;
  }

  const priorityRuns = cur7.filter((r) => priorityIds.has(r.prompt_id));
  const shortlistShare = priorityIds.size > 0 ? rate(priorityRuns) : null;

  return {
    visibilityRate,
    visibilityDelta,
    citationShare,
    shortlistShare,
    runsIn7d: cur7.length,
  };
}

// ---------- Overview body: today's mission + trend + radar ----------
async function OverviewBody({ brand }: { brand: Brand }) {
  const supabase = await createClient();

  // Today's mission = top open opportunity by priority.
  let topOpp: { id: string; title: string; type: string; priority_score: number | null } | null = null;
  try {
    const opps = await listOpportunities(brand.id, { status: "open" }, supabase);
    topOpp = opps[0]
      ? {
          id: opps[0].id,
          title: opps[0].title,
          type: opps[0].type,
          priority_score: opps[0].priority_score,
        }
      : null;
  } catch {
    // Table may not exist in a fresh install; degrade quietly.
  }

  return (
    <div className="space-y-6">
      {/* Today's Mission — the anchor block */}
      <section aria-label="Today's mission" className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden />
              <p className="section-label text-accent">Today&rsquo;s mission</p>
            </div>
            {topOpp ? (
              <>
                <h2 className="mt-1 text-lg font-semibold text-ink">{topOpp.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  Priority {(Number(topOpp.priority_score ?? 0) * 100).toFixed(0)}% ·{" "}
                  {topOpp.type.replace(/_/g, " ")}
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-lg font-semibold text-ink">You&rsquo;re on track</h2>
                <p className="mt-1 text-sm text-muted">
                  No open opportunities right now. Run a scan or check the recommendations tab.
                </p>
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {topOpp && (
              <Link
                href={`/dashboard/w/brand/${brand.slug}/recommendations`}
                className="btn-sm"
              >
                Start now
              </Link>
            )}
            <Link
              href={`/dashboard/w/brand/${brand.slug}/recommendations`}
              className="text-xs font-medium text-accent hover:underline"
            >
              View queue →
            </Link>
          </div>
        </div>
      </section>

      {/* Two-column deep-dive links */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title="Full Mission Control"
          description="Today's mission, activity feed, competitor radar, weekly progress — the operational cockpit."
          href={`/dashboard/b/${brand.slug}`}
          meta="Mission Control"
        />
        <InsightCard
          variant="opportunity"
          title="Deep visibility"
          description="Engine breakdown, prompt-level rates, mention verification."
          href={`/dashboard/w/brand/${brand.slug}/visibility`}
          meta="Visibility"
        />
      </div>
    </div>
  );
}

const brandWorkspace = defineWorkspace<Brand>({
  kind: "brand",
  slugParam: "slug",

  async loader({ slug }) {
    return await getBrandFromSlug(slug);
  },

  header: (b) => ({
    title: b.name,
    subtitle: b.domain ?? undefined,
    chips: [
      ...(b.industry ? [{ label: "Industry", value: b.industry }] : []),
      { label: "Slug", value: b.slug },
    ],
  }),

  async summary(b) {
    const kpi = await loadBrandKpis(b.id);
    return [
      {
        key: "visibility",
        label: "Visibility 7d",
        value: kpi.visibilityRate == null ? "—" : `${kpi.visibilityRate}%`,
        delta: kpi.visibilityDelta ?? undefined,
        deltaFormat: "pp",
        hint: kpi.runsIn7d ? `${kpi.runsIn7d} runs` : "no runs yet",
        href: `/dashboard/w/brand/${b.slug}/visibility`,
      },
      {
        key: "citation-share",
        label: "Citation share",
        value: kpi.citationShare == null ? "—" : `${kpi.citationShare}%`,
        hint: "own-domain / all cited domains",
        href: `/dashboard/b/${b.slug}/citations`,
      },
      {
        key: "shortlist",
        label: "Shortlist share",
        value: kpi.shortlistShare == null ? "—" : `${kpi.shortlistShare}%`,
        hint: "priority prompts, last 7d",
        href: `/dashboard/w/brand/${b.slug}/prompts`,
      },
      {
        key: "runs",
        label: "Runs 7d",
        value: kpi.runsIn7d,
        hint: "visibility checks completed",
        href: `/dashboard/b/${b.slug}/history`,
      },
    ];
  },

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <OverviewBody brand={b} />
        </>
      ),
    },
    {
      key: "recommendations",
      label: "Recommendations",
      icon: Lightbulb,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <RecommendationsBody brand={b} />
        </>
      ),
    },
    {
      key: "visibility",
      label: "Visibility",
      icon: LineChart,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <VisibilityBody brand={b} slug={b.slug} />
        </>
      ),
    },
    {
      key: "competitors",
      label: "Competitors",
      icon: Swords,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <CompetitorsBody brand={b} />
        </>
      ),
    },
    {
      key: "content",
      label: "Content",
      icon: PenSquare,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <ContentBody brand={b} />
        </>
      ),
    },
    {
      key: "history",
      label: "History",
      icon: History,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <HistoryBody brand={b} />
        </>
      ),
    },
    {
      key: "insights",
      label: "Insights",
      icon: Sparkles,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <InsightsBody brand={b} />
        </>
      ),
    },
    {
      key: "prompts",
      label: "Prompts",
      icon: MessageSquare,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <PromptsBody brand={b} />
        </>
      ),
    },
    {
      key: "campaigns",
      label: "Campaigns",
      icon: Megaphone,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <CampaignsBody brand={b} />
        </>
      ),
    },
    {
      key: "reports",
      label: "Reports",
      icon: FileDown,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <ReportsBody brand={b} />
        </>
      ),
    },
    {
      key: "benchmark",
      label: "Benchmark",
      icon: Trophy,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <BenchmarkBody brand={b} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: b }) => (
        <>
          <BrandWorkspaceListeners brandId={b.id} />
          <CopilotBody brand={b} />
        </>
      ),
    },
  ],

  // ---------- Timeline (opt-in per spec) ----------
  timeline: (b) => ({
    async entries() {
      const supabase = await createClient();
      // Union: visibility_runs (scans) + content_items (drafts) + tasks (missions).
      // Each source contributes at most 40 rows; we merge, sort desc, cap 60.
      const [runsRes, contentRes, tasksRes] = await Promise.all([
        supabase
          .from("visibility_runs")
          .select("id, run_at, engine, brand_mentioned, prompt_id")
          .in(
            "prompt_id",
            (
              await supabase.from("prompts").select("id").eq("brand_id", b.id).limit(500)
            ).data?.map((p: { id: string }) => p.id) ?? [],
          )
          .order("run_at", { ascending: false })
          .limit(40),
        supabase
          .from("content_items")
          .select("id, created_at, title, status")
          .eq("brand_id", b.id)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("tasks")
          .select("id, created_at, kind, title, status")
          .eq("brand_id", b.id)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      type Row = {
        id: string;
        at: string;
        kind: string;
        message: string;
        href?: string;
      };
      const rows: Row[] = [];
      for (const r of (runsRes.data as { id: string; run_at: string; engine: string; brand_mentioned: boolean | null }[]) ?? []) {
        rows.push({
          id: `run-${r.id}`,
          at: r.run_at,
          kind: "scan",
          message: `${r.engine} scan · ${r.brand_mentioned ? "mentioned" : "not mentioned"}`,
          href: `/dashboard/b/${b.slug}/history`,
        });
      }
      for (const c of (contentRes.data as { id: string; created_at: string; title: string; status: string }[]) ?? []) {
        rows.push({
          id: `content-${c.id}`,
          at: c.created_at,
          kind: "content",
          message: `${c.title} · ${c.status}`,
          href: `/dashboard/w/brand/${b.slug}/content`,
        });
      }
      for (const t of (tasksRes.data as { id: string; created_at: string; kind: string; title: string; status: string }[]) ?? []) {
        rows.push({
          id: `task-${t.id}`,
          at: t.created_at,
          kind: t.kind ?? "task",
          message: `${t.title} · ${t.status}`,
        });
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 60);
    },
  }),

  // ---------- Activity feed (server rendered; SSE upgrade is the app's live wrapper) ----------
  activity: (b) => ({
    async entries() {
      const supabase = await createClient();
      // Same rows as feed/stream initial payload: recent runs + alerts + tasks.
      const [firings, runs] = await Promise.all([
        supabase
          .from("geo_alert_firings")
          .select("id, fired_at, message, alert_id")
          .eq("brand_id", b.id)
          .order("fired_at", { ascending: false })
          .limit(6),
        supabase
          .from("visibility_runs")
          .select("id, run_at, engine, brand_mentioned")
          .in(
            "prompt_id",
            (
              await supabase.from("prompts").select("id").eq("brand_id", b.id).limit(200)
            ).data?.map((p: { id: string }) => p.id) ?? [],
          )
          .order("run_at", { ascending: false })
          .limit(6),
      ]);
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      for (const f of (firings.data as { id: string; fired_at: string; message: string }[]) ?? []) {
        rows.push({
          id: `alert-${f.id}`,
          at: f.fired_at,
          kind: "alert",
          message: f.message,
          href: `/dashboard/b/${b.slug}/alerts`,
        });
      }
      for (const r of (runs.data as { id: string; run_at: string; engine: string; brand_mentioned: boolean | null }[]) ?? []) {
        rows.push({
          id: `run-${r.id}`,
          at: r.run_at,
          kind: "scan",
          message: `${r.engine} · ${r.brand_mentioned ? "mentioned" : "not mentioned"}`,
        });
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 12);
    },
    stream: { url: `/api/feed/stream?brandId=${b.id}` },
  }),

  // ---------- Related objects graph ----------
  related: (b) => ({
    async nodes() {
      const supabase = await createClient();
      const [comp, prompts, camps] = await Promise.all([
        supabase
          .from("competitors")
          .select("id, name")
          .eq("brand_id", b.id)
          .limit(5),
        supabase
          .from("prompts")
          .select("id, text")
          .eq("brand_id", b.id)
          .order("priority", { ascending: false })
          .limit(5),
        supabase
          .from("campaigns")
          .select("id, title")
          .eq("brand_id", b.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      for (const c of (comp.data as { id: string; name: string }[]) ?? []) {
        nodes.push({ kind: "competitor", id: c.id, label: c.name, relation: "competes_with" });
      }
      for (const p of (prompts.data as { id: string; text: string }[]) ?? []) {
        nodes.push({
          kind: "prompt",
          id: p.id,
          label: (p.text ?? "").slice(0, 60) || "prompt",
          relation: "tracked_prompts",
        });
      }
      for (const c of (camps.data as { id: string; title: string }[]) ?? []) {
        nodes.push({ kind: "campaign", id: c.id, label: c.title, relation: "active_campaigns" });
      }
      return nodes;
    },
  }),

  // ---------- Quick actions ----------
  quickActions: (b) => [
    {
      id: "run-scan",
      label: "Run scan",
      icon: Play,
      keyboard: "e",
      variant: "primary",
      // Fires a client event; a listener (added on the workspace mount)
      // can trigger /api/visibility-check for this brand.
      event: { name: "brand:run-scan", detail: { brandId: b.id, slug: b.slug } },
    },
    {
      id: "new-prompt",
      label: "New prompt",
      icon: FilePlus,
      keyboard: "p",
      href: `/dashboard/w/brand/${b.slug}/prompts?new=1`,
    },
    {
      id: "report",
      label: "Report",
      icon: FileText,
      keyboard: "r",
      href: `/dashboard/w/brand/${b.slug}/reports`,
    },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "brand:share", detail: { brandId: b.id, slug: b.slug } },
    },
  ],

  copilotContext: (b) => ({
    kind: "brand",
    id: b.id,
    label: b.name,
    summary: b.domain ? `Brand ${b.name} (${b.domain})` : `Brand ${b.name}`,
    hints: [
      "Answer with real data from the current brand.",
      "Never invent citations, competitor moves, or mentions.",
    ],
  }),

  capabilities: {
    share: true,
    export: true,
    delete: false,
    api: true,
  },
});

export default brandWorkspace;
