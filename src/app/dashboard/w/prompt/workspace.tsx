import Link from "next/link";
import {
  LayoutDashboard, Lightbulb, Swords, Globe, History, Wrench, Network,
  Sparkles, Bot, Play, Star, Share2, PenSquare,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import { getPromptById, timeAgo, type Prompt } from "@/lib/prompt-workspace";
import { languageName } from "@/lib/languages";
import { intentLabel } from "@/lib/intent";

import OverviewBody from "./tabs/overview";
import RecommendationsBody from "./tabs/recommendations";
import CompetitorsBody from "./tabs/competitors";
import SourcesBody from "./tabs/sources";
import HistoryBody from "./tabs/history";
import OptimizationBody from "./tabs/optimization";
import RelatedBody from "./tabs/related";
import InsightsBody from "./tabs/insights";
import CopilotBody from "./tabs/copilot";
import PromptWorkspaceListeners from "./PromptWorkspaceListeners.client";

// ============================================================
// Prompt workspace descriptor.
//
// Inherits the same WorkspaceDescriptor contract as Brand. Nine tabs,
// prompt-scoped KPIs, timeline sourced from history_observations +
// history_events + opportunity_recommendations, activity feed via the
// shared /api/feed/stream, related graph via cookie-scoped queries,
// serializable quick actions bound to E / P / S / (draft answer).
//
// The client listener component is rendered inside the Overview so it
// mounts once when the workspace loads. Any tab renders it in place —
// but only Overview does the mount so we don't duplicate handlers on
// tab switches (the framework re-runs render() per tab).
// ============================================================

function healthFromRate(rate: number | null): "healthy" | "warning" | "critical" | "unknown" {
  if (rate == null) return "unknown";
  if (rate <= 0) return "critical";
  if (rate < 25) return "warning";
  return "healthy";
}

const promptWorkspace = defineWorkspace<Prompt>({
  kind: "prompt",
  slugParam: "slug",

  async loader({ slug }) {
    return await getPromptById(slug);
  },

  header: (p) => ({
    title: p.text.length > 90 ? p.text.slice(0, 90) + "…" : p.text,
    subtitle: [languageName(p.language), intentLabel(p.intent), p.priority ? "★ Priority" : null]
      .filter(Boolean)
      .join(" · "),
    status: p.is_active ? "Active" : "Paused",
    statusTone: p.is_active ? "accent" : "neutral",
    health: healthFromRate(p.stats.mentionRate7d),
    chips: [
      { label: "Brand", value: p.brand.name },
      { label: "Runs", value: String(p.stats.runCount) },
      { label: "Last check", value: timeAgo(p.stats.lastRunAt) },
    ],
  }),

  async summary(p) {
    const supabase = await createClient();
    // Positions + citation share for the last 14 days
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id, run_at, brand_mentioned, brand_position, engine_id")
      .eq("prompt_id", p.id)
      .order("run_at", { ascending: false })
      .limit(500);

    const rows = (runs as { id: string; run_at: string; brand_mentioned: boolean | null; brand_position: number | null; engine_id: string }[] | null) ?? [];
    const now = Date.now();
    const week = 7 * 86_400_000;
    const cur7 = rows.filter((r) => now - new Date(r.run_at).getTime() < week);
    const prev7 = rows.filter((r) => {
      const t = now - new Date(r.run_at).getTime();
      return t >= week && t < 2 * week;
    });
    const rate = (rs: typeof cur7) => {
      const nonSkip = rs.filter((r) => r.brand_mentioned !== null);
      if (nonSkip.length === 0) return null;
      const mentioned = nonSkip.filter((r) => r.brand_mentioned === true).length;
      return Math.round((mentioned / nonSkip.length) * 100);
    };
    const curRate = rate(cur7);
    const prevRate = rate(prev7);
    const delta = curRate != null && prevRate != null ? curRate - prevRate : null;

    const positions = cur7
      .filter((r) => r.brand_mentioned === true && r.brand_position != null)
      .map((r) => r.brand_position as number);
    const avgPos =
      positions.length > 0 ? (positions.reduce((a, b) => a + b, 0) / positions.length) : null;

    // Citation share for the prompt: own vs all cited in the last 7d of runs.
    let citationShare: number | null = null;
    const recentIds = cur7.slice(0, 200).map((r) => r.id);
    if (recentIds.length > 0) {
      const { data: cits } = await supabase
        .from("citations")
        .select("is_own_domain")
        .in("run_id", recentIds);
      const c = (cits as { is_own_domain: boolean | null }[] | null) ?? [];
      if (c.length > 0) {
        const own = c.filter((x) => x.is_own_domain === true).length;
        citationShare = Math.round((own / c.length) * 100);
      }
    }

    const enginesCovered = new Set(cur7.map((r) => r.engine_id).filter(Boolean)).size;

    return [
      {
        key: "mention-rate",
        label: "Mention rate 7d",
        value: curRate == null ? "—" : `${curRate}%`,
        delta: delta ?? undefined,
        deltaFormat: "pp",
        hint: cur7.length ? `${cur7.length} runs` : "no runs yet",
        href: `/dashboard/w/prompt/${p.id}/history`,
      },
      {
        key: "avg-position",
        label: "Avg position",
        value: avgPos == null ? "—" : avgPos.toFixed(1),
        hint: positions.length ? `over ${positions.length} mentions` : "no mentions",
        href: `/dashboard/w/prompt/${p.id}/insights`,
      },
      {
        key: "citation-share",
        label: "Own citation share",
        value: citationShare == null ? "—" : `${citationShare}%`,
        hint: "own-domain / all citations, 7d",
        href: `/dashboard/w/prompt/${p.id}/sources`,
      },
      {
        key: "engines",
        label: "Engines covered",
        value: enginesCovered,
        hint: enginesCovered > 0 ? "distinct engines, 7d" : "run a scan",
        href: `/dashboard/w/prompt/${p.id}/history`,
      },
    ];
  },

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      // Overview mounts the listener component alongside the body so
      // quick-action events are handled while the workspace is open.
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <OverviewBody prompt={p} />
        </>
      ),
    },
    {
      key: "recommendations",
      label: "Recommendations",
      icon: Lightbulb,
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <RecommendationsBody prompt={p} />
        </>
      ),
    },
    {
      key: "competitors",
      label: "Competitors",
      icon: Swords,
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <CompetitorsBody prompt={p} />
        </>
      ),
    },
    {
      key: "sources",
      label: "Sources",
      icon: Globe,
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <SourcesBody prompt={p} />
        </>
      ),
    },
    {
      key: "history",
      label: "History",
      icon: History,
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <HistoryBody prompt={p} />
        </>
      ),
    },
    {
      key: "optimization",
      label: "Optimization",
      icon: Wrench,
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <OptimizationBody prompt={p} />
        </>
      ),
    },
    {
      key: "related",
      label: "Related",
      icon: Network,
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <RelatedBody prompt={p} />
        </>
      ),
    },
    {
      key: "insights",
      label: "Insights",
      icon: Sparkles,
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <InsightsBody prompt={p} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: p }) => (
        <>
          <PromptWorkspaceListeners promptId={p.id} currentPriority={p.priority} />
          <CopilotBody prompt={p} />
        </>
      ),
    },
  ],

  // ---------- Timeline: runs + history events + linked opportunities ----------
  timeline: (p) => ({
    async entries() {
      const supabase = await createClient();
      const [runsRes, eventsRes, oppsRes] = await Promise.all([
        supabase
          .from("visibility_runs")
          .select("id, run_at, engine_id, brand_mentioned")
          .eq("prompt_id", p.id)
          .order("run_at", { ascending: false })
          .limit(40),
        supabase
          .from("history_events")
          .select("id, occurred_at, event_type, engine_name")
          .eq("prompt_id", p.id)
          .order("occurred_at", { ascending: false })
          .limit(20),
        supabase
          .from("opportunity_recommendations")
          .select("id, created_at, title, detail")
          .eq("brand_id", p.brand_id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const { data: engines } = await supabase.from("engines").select("id, name");
      const engineMap = new Map<string, string>();
      for (const e of (engines as { id: string; name: string }[] | null) ?? []) {
        engineMap.set(e.id, e.name);
      }

      type Row = { id: string; at: string; kind: string; message: string; href?: string };
      const rows: Row[] = [];
      for (const r of (runsRes.data as { id: string; run_at: string; engine_id: string; brand_mentioned: boolean | null }[] | null) ?? []) {
        const engineName = engineMap.get(r.engine_id) ?? "engine";
        rows.push({
          id: `run-${r.id}`,
          at: r.run_at,
          kind: "scan",
          message: `${engineName.replace(/_/g, " ")} · ${r.brand_mentioned === null ? "skipped" : r.brand_mentioned ? "mentioned" : "not mentioned"}`,
          href: `/dashboard/w/prompt/${p.id}/history?run=${r.id}`,
        });
      }
      for (const e of (eventsRes.data as { id: string; occurred_at: string; event_type: string; engine_name: string | null }[] | null) ?? []) {
        rows.push({
          id: `evt-${e.id}`,
          at: e.occurred_at,
          kind: "event",
          message: `${e.event_type.replace(/_/g, " ").toLowerCase()}${e.engine_name ? ` · ${e.engine_name}` : ""}`,
          href: `/dashboard/w/prompt/${p.id}/history`,
        });
      }
      for (const o of (oppsRes.data as { id: string; created_at: string; title: string; detail: { prompt_id?: string } | null }[] | null) ?? []) {
        // Only include opportunities that reference this prompt (or have no prompt reference).
        const pid = o.detail?.prompt_id;
        if (pid && pid !== p.id) continue;
        rows.push({
          id: `opp-${o.id}`,
          at: o.created_at,
          kind: "opportunity",
          message: `Opportunity: ${o.title}`,
          href: `/dashboard/w/prompt/${p.id}/recommendations`,
        });
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 60);
    },
  }),

  // ---------- Activity feed (initial payload; stream URL for live updates) ----------
  activity: (p) => ({
    async entries() {
      const supabase = await createClient();
      const { data: runs } = await supabase
        .from("visibility_runs")
        .select("id, run_at, engine_id, brand_mentioned")
        .eq("prompt_id", p.id)
        .order("run_at", { ascending: false })
        .limit(8);
      const { data: engines } = await supabase.from("engines").select("id, name");
      const engineMap = new Map<string, string>();
      for (const e of (engines as { id: string; name: string }[] | null) ?? []) {
        engineMap.set(e.id, e.name);
      }
      const rows = ((runs as { id: string; run_at: string; engine_id: string; brand_mentioned: boolean | null }[] | null) ?? []).map((r) => ({
        id: `run-${r.id}`,
        at: r.run_at,
        kind: "scan",
        message: `${(engineMap.get(r.engine_id) ?? "engine").replace(/_/g, " ")} · ${r.brand_mentioned === null ? "skipped" : r.brand_mentioned ? "mentioned" : "not mentioned"}`,
        href: `/dashboard/w/prompt/${p.id}/history?run=${r.id}`,
      }));
      return rows;
    },
    // The shared feed stream is currently brand-scoped; the /api server
    // side needs a `promptId` filter to be truly prompt-live. Until that
    // ships, this URL will just no-op cleanly (server ignores unknown
    // query keys). Keeping the descriptor honest.
    stream: { url: `/api/feed/stream?brandId=${p.brand_id}&promptId=${p.id}` },
  }),

  // ---------- Related graph ----------
  related: (p) => ({
    async nodes() {
      const supabase = await createClient();
      const [siblingsRes, competitorsRes] = await Promise.all([
        supabase
          .from("prompts")
          .select("id, text, intent")
          .eq("brand_id", p.brand_id)
          .neq("id", p.id)
          .order("priority", { ascending: false })
          .limit(6),
        supabase
          .from("competitors")
          .select("id, name")
          .eq("brand_id", p.brand_id)
          .eq("confirmed", true)
          .limit(4),
      ]);

      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: p.brand.id, label: p.brand.name, relation: "belongs_to" });
      for (const s of (siblingsRes.data as { id: string; text: string; intent: string | null }[] | null) ?? []) {
        nodes.push({
          kind: "prompt",
          id: s.id,
          label: (s.text ?? "").slice(0, 60) || "prompt",
          relation: "similar_to",
        });
      }
      for (const c of (competitorsRes.data as { id: string; name: string }[] | null) ?? []) {
        nodes.push({ kind: "competitor", id: c.id, label: c.name, relation: "competes_on" });
      }
      return nodes;
    },
  }),

  // ---------- Quick actions (serializable) ----------
  quickActions: (p) => [
    {
      id: "run-scan",
      label: "Run scan",
      icon: Play,
      keyboard: "e",
      variant: "primary",
      event: { name: "prompt:run-scan", detail: { promptId: p.id } },
    },
    {
      id: "priority",
      label: p.priority ? "★ Priority" : "Set priority",
      icon: Star,
      keyboard: "p",
      event: { name: "prompt:toggle-priority", detail: { promptId: p.id, next: !p.priority } },
    },
    {
      id: "draft",
      label: "Draft answer",
      icon: PenSquare,
      href: `/dashboard/w/brand/${p.brand.slug}/content?promptId=${p.id}`,
    },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "prompt:share", detail: { promptId: p.id } },
    },
  ],

  copilotContext: (p) => ({
    kind: "prompt",
    id: p.id,
    label: p.text.length > 100 ? p.text.slice(0, 100) + "…" : p.text,
    summary: `Prompt "${p.text}" tracked for brand ${p.brand.name} in ${languageName(p.language)}, intent ${intentLabel(p.intent)}.${
      p.stats.mentionRate7d != null
        ? ` ${p.stats.mentionRate7d}% mention rate last 7d across ${p.stats.enginesActive} engines.`
        : " No runs yet."
    }`,
    hints: [
      "Answer with real data from this prompt's visibility_runs and citations only.",
      "Do not invent competitor moves, citations, or mentions.",
      "When suggesting content, produce drafts with [ADD ...] placeholders — never invent specifics.",
    ],
  }),

  capabilities: {
    share: true,
    export: true,
    delete: false,
    api: true,
  },
});

// Silence unused-import complaints when Link/etc. isn't referenced in
// this file's default export path — the tab renderers use them internally
// but TypeScript still marks direct imports.
export const _unused = { Link };

export default promptWorkspace;
