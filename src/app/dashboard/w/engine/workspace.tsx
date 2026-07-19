import {
  LayoutDashboard,
  Brain,
  ListChecks,
  Globe,
  MessageSquare,
  Activity,
  Wrench,
  History,
  Compass,
  Bot,
  Share2,
  Play,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import {
  getEngineByName, timeAgo, ENGINE_META_MAP, type Engine,
} from "@/lib/engine-workspace";

import OverviewBody from "./tabs/overview";
import BehaviorBody from "./tabs/behavior";
import RecommendationsBody from "./tabs/recommendations";
import CitationsBody from "./tabs/citations";
import PromptsBody from "./tabs/prompts";
import ModelChangesBody from "./tabs/model-changes";
import OptimizationBody from "./tabs/optimization";
import HistoryBody from "./tabs/history";
import InsightsBody from "./tabs/insights";
import CopilotBody from "./tabs/copilot";
import EngineWorkspaceListeners from "./EngineWorkspaceListeners.client";

// ============================================================
// Engine workspace descriptor. Each engine is a first-class object —
// the tabs answer:
//   How does this AI think? (Overview + Behavior)
//   Why does it recommend competitors? (Insights + Prompt Coverage)
//   What changed recently? (Model Changes)
//   How do I optimize? (Optimization + Recommendations)
//
// Slug = engine name. Brand context is pulled from the cookie
// (getSelectedBrand). Unknown engine or no brand → null → 404.
// ============================================================

function healthFromEngine(e: Engine): "healthy" | "warning" | "critical" | "unknown" {
  if (!e.is_active) return "unknown";
  if (e.stats.runCount === 0) return "unknown";
  if (e.stats.mentionRate == null) return "unknown";
  if (e.stats.mentionRate === 0) return "critical";
  if (e.stats.mentionRate < 25) return "warning";
  return "healthy";
}

const engineWorkspace = defineWorkspace<Engine>({
  kind: "engine",
  slugParam: "slug",

  async loader({ slug }) {
    return await getEngineByName(slug);
  },

  header: (e) => ({
    title: e.displayName,
    subtitle: `${e.meta.note} · Context: ${e.brand.name}`,
    status: e.is_active ? "Active" : "Disabled",
    statusTone: e.is_active ? "accent" : "neutral",
    health: healthFromEngine(e),
    chips: [
      { label: "Brand", value: e.brand.name },
      { label: e.meta.cites ? "Cites" : "Rarely cites" },
      ...(e.meta.requiresKey ? [{ label: "Requires", value: e.meta.requiresKey }] : []),
      { label: "Last run", value: timeAgo(e.stats.lastRunAt) },
    ],
  }),

  summary: (e) => [
    {
      key: "mention-rate",
      label: "Mention rate",
      value: e.stats.mentionRate == null ? "—" : `${e.stats.mentionRate}%`,
      hint: `${e.stats.runCount} run${e.stats.runCount === 1 ? "" : "s"}`,
      href: `/dashboard/w/engine/${e.name}/prompts`,
    },
    {
      key: "rate-7d",
      label: "Rate 7d",
      value: e.stats.mentionRate7d == null ? "—" : `${e.stats.mentionRate7d}%`,
      delta: e.stats.mentionRate7dDelta ?? undefined,
      deltaFormat: "pp",
      hint: "vs prior 7d",
      href: `/dashboard/w/engine/${e.name}/model-changes`,
    },
    {
      key: "citations",
      label: "Citations",
      value: e.stats.citationCount,
      hint:
        e.stats.ownCitationShare != null
          ? `${e.stats.ownCitationShare}% own domain`
          : e.meta.cites
            ? "run more scans"
            : "engine rarely cites",
      href: `/dashboard/w/engine/${e.name}/citations`,
    },
    {
      key: "changes",
      label: "Change events",
      value: e.changeEvents30d,
      hint: e.changeEvents30d === 0 ? "steady last 30d" : "detected shifts",
      href: `/dashboard/w/engine/${e.name}/model-changes`,
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <OverviewBody engine={e} />
        </>
      ),
    },
    {
      key: "behavior",
      label: "Behavior",
      icon: Brain,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <BehaviorBody engine={e} />
        </>
      ),
    },
    {
      key: "recommendations",
      label: "Recommendations",
      icon: ListChecks,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <RecommendationsBody engine={e} />
        </>
      ),
    },
    {
      key: "citations",
      label: "Citations",
      icon: Globe,
      render: ({ object: e, searchParams }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <CitationsBody engine={e} searchParams={searchParams} />
        </>
      ),
    },
    {
      key: "prompts",
      label: "Prompt Coverage",
      icon: MessageSquare,
      render: ({ object: e, searchParams }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <PromptsBody engine={e} searchParams={searchParams} />
        </>
      ),
    },
    {
      key: "model-changes",
      label: "Model Changes",
      icon: Activity,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <ModelChangesBody engine={e} />
        </>
      ),
    },
    {
      key: "optimization",
      label: "Optimization",
      icon: Wrench,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <OptimizationBody engine={e} />
        </>
      ),
    },
    {
      key: "history",
      label: "History",
      icon: History,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <HistoryBody engine={e} />
        </>
      ),
    },
    {
      key: "insights",
      label: "Insights",
      icon: Compass,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <InsightsBody engine={e} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "AI Copilot",
      icon: Bot,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineName={e.name} engineDisplay={e.displayName} />
          <CopilotBody engine={e} />
        </>
      ),
    },
  ],

  activity: (e) => ({
    async entries() {
      const supabase = await createClient();
      const { data: prompts } = await supabase
        .from("prompts")
        .select("id, text")
        .eq("brand_id", e.brand.id)
        .limit(500);
      const promptText = new Map(
        ((prompts as { id: string; text: string }[] | null) ?? []).map((p) => [p.id, p.text]),
      );
      const promptIds = Array.from(promptText.keys());
      if (promptIds.length === 0) return [];
      const { data: runs } = await supabase
        .from("visibility_runs")
        .select("id, run_at, prompt_id, brand_mentioned")
        .eq("engine_id", e.id)
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(10);
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      for (const r of (runs as { id: string; run_at: string; prompt_id: string; brand_mentioned: boolean | null }[] | null) ?? []) {
        rows.push({
          id: `run-${r.id}`,
          at: r.run_at,
          kind: "scan",
          message: `${r.brand_mentioned === null ? "skipped" : r.brand_mentioned ? "mentioned" : "missed"} · ${(promptText.get(r.prompt_id) ?? "prompt").slice(0, 50)}`,
          href: `/dashboard/w/prompt/${r.prompt_id}/history?run=${r.id}`,
        });
      }
      return rows;
    },
  }),

  related: (e) => ({
    async nodes() {
      const supabase = await createClient();
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: e.brand.id, label: e.brand.name, relation: "context" });
      // Sibling engines — every registered engine except this one.
      for (const [name, meta] of Object.entries(ENGINE_META_MAP)) {
        if (name === e.name) continue;
        nodes.push({ kind: "engine", id: name, label: meta.displayName, relation: "sibling" });
      }
      // Top priority prompts on this brand — they matter most for engine coverage.
      const { data: prompts } = await supabase
        .from("prompts")
        .select("id, text")
        .eq("brand_id", e.brand.id)
        .order("priority", { ascending: false })
        .limit(4);
      for (const p of (prompts as { id: string; text: string }[] | null) ?? []) {
        nodes.push({
          kind: "prompt",
          id: p.id,
          label: (p.text ?? "").slice(0, 60) || "prompt",
          relation: "priority_prompts",
        });
      }
      // Top cited domains — the knowledge-graph edge from engine to sources.
      const { data: promptIdsRes } = await supabase
        .from("prompts")
        .select("id")
        .eq("brand_id", e.brand.id)
        .limit(500);
      const promptIds = ((promptIdsRes as { id: string }[] | null) ?? []).map((p) => p.id);
      if (promptIds.length > 0) {
        const { data: runs } = await supabase
          .from("visibility_runs")
          .select("id")
          .eq("engine_id", e.id)
          .in("prompt_id", promptIds)
          .limit(500);
        const runIds = ((runs as { id: string }[] | null) ?? []).map((r) => r.id);
        if (runIds.length > 0) {
          const { data: cits } = await supabase
            .from("citations")
            .select("cited_domain")
            .in("run_id", runIds);
          const counts = new Map<string, number>();
          for (const c of (cits as { cited_domain: string | null }[] | null) ?? []) {
            const d = c.cited_domain;
            if (!d) continue;
            counts.set(d, (counts.get(d) ?? 0) + 1);
          }
          const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
          for (const [domain] of top) {
            nodes.push({
              kind: "source",
              id: domain,
              label: domain,
              relation: "cites",
            });
          }
        }
      }
      return nodes;
    },
  }),

  quickActions: (e) => [
    {
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "engine:share", detail: { engineName: e.name } },
    },
    {
      id: "simulate",
      label: "Simulate a move",
      icon: Play,
      keyboard: "m",
      event: { name: "engine:simulate", detail: { engineName: e.name } },
    },
    {
      id: "compare",
      label: "Compare engines",
      icon: BarChart3,
      keyboard: "c",
      event: { name: "engine:compare", detail: { engineName: e.name } },
    },
    {
      id: "strategy",
      label: "Generate optimization",
      icon: Sparkles,
      keyboard: "g",
      event: { name: "engine:strategy", detail: { engineName: e.name } },
    },
  ],

  copilotContext: (e) => ({
    kind: "engine",
    id: e.name,
    label: e.displayName,
    summary: `Engine "${e.displayName}" answering questions about brand ${e.brand.name}.${e.stats.mentionRate != null ? ` Mention rate ${e.stats.mentionRate}% over ${e.stats.runCount} runs.` : ""}${e.stats.ownCitationShare != null ? ` Own-citation share ${e.stats.ownCitationShare}%.` : ""}${e.personality.runs_observed > 0 ? ` Personality: verbosity ${Math.round(e.personality.verbosity)}, hedging ${Math.round(e.personality.hedging)}, format_bias ${Math.round(e.personality.format_bias)}.` : ""}`,
    hints: [
      "Answer ONLY from this engine's runs against the current brand. Never invent behavior for other engines.",
      "When the user asks 'why did it recommend X', point at the specific run + response text.",
      "For content drafts, keep [ADD ...] placeholders — never invent owner-only facts.",
      "Deterministic-first: cite counts and rates from the data. If data is missing, say so.",
    ],
  }),

  capabilities: {
    share: true,
    export: true,
    delete: false,
    api: false,
  },
});

export default engineWorkspace;
