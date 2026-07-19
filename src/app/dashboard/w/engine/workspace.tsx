import { LayoutDashboard, MessageSquare, Globe, Swords, History, Bot, Share2 } from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import {
  getEngineByName, timeAgo, ENGINE_META_MAP, type Engine,
} from "@/lib/engine-workspace";

import OverviewBody from "./tabs/overview";
import PromptsBody from "./tabs/prompts";
import SourcesBody from "./tabs/sources";
import CompetitorsBody from "./tabs/competitors";
import HistoryBody from "./tabs/history";
import CopilotBody from "./tabs/copilot";
import EngineWorkspaceListeners from "./EngineWorkspaceListeners.client";

// ============================================================
// Engine workspace descriptor. Seventh UWE kind.
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
      href: `/dashboard/w/engine/${e.name}/history`,
    },
    {
      key: "avg-pos",
      label: "Avg position",
      value: e.stats.avgPosition == null ? "—" : e.stats.avgPosition,
      hint: e.stats.runCount > 0 ? "when mentioned" : "no mentions",
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
      href: `/dashboard/w/engine/${e.name}/sources`,
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineId={e.id} />
          <OverviewBody engine={e} />
        </>
      ),
    },
    {
      key: "prompts",
      label: "Prompts",
      icon: MessageSquare,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineId={e.id} />
          <PromptsBody engine={e} />
        </>
      ),
    },
    {
      key: "sources",
      label: "Sources",
      icon: Globe,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineId={e.id} />
          <SourcesBody engine={e} />
        </>
      ),
    },
    {
      key: "competitors",
      label: "Competitors",
      icon: Swords,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineId={e.id} />
          <CompetitorsBody engine={e} />
        </>
      ),
    },
    {
      key: "history",
      label: "History",
      icon: History,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineId={e.id} />
          <HistoryBody engine={e} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: e }) => (
        <>
          <EngineWorkspaceListeners engineId={e.id} />
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
  ],

  copilotContext: (e) => ({
    kind: "engine",
    id: e.name,
    label: e.displayName,
    summary: `Engine "${e.displayName}" answering questions about brand ${e.brand.name}.${e.stats.mentionRate != null ? ` Mention rate ${e.stats.mentionRate}% over ${e.stats.runCount} runs.` : ""}${e.stats.ownCitationShare != null ? ` Own-citation share ${e.stats.ownCitationShare}%.` : ""}`,
    hints: [
      "Answer from real visibility_runs + citations for this engine only.",
      "Never invent engine behavior — if data is missing, say so.",
      "For content drafts, keep [ADD ...] placeholders.",
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
