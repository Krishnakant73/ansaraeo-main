import {
  LayoutDashboard, MessageSquare, Globe, Shield, History, Sparkles, Bot,
  Check, X, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import { getCompetitorById, timeAgo, type Competitor } from "@/lib/competitor-workspace";

import OverviewBody from "./tabs/overview";
import PromptsBody from "./tabs/prompts";
import SourcesBody from "./tabs/sources";
import BattlecardBody from "./tabs/battlecard";
import HistoryBody from "./tabs/history";
import InsightsBody from "./tabs/insights";
import CopilotBody from "./tabs/copilot";
import CompetitorWorkspaceListeners from "./CompetitorWorkspaceListeners.client";

// ============================================================
// Competitor workspace descriptor.
//
// Third UWE kind, same contract as Brand + Prompt. Seven tabs, KPIs
// computed off visibility_runs.competitor_mentions, quick actions
// bound to confirm / reject / share. Listener mount lives inside
// every tab render so quick-action events fire regardless of which
// tab is active.
// ============================================================

function healthFromGap(gap: number | null): "healthy" | "warning" | "critical" | "unknown" {
  if (gap == null) return "unknown";
  if (gap >= 25) return "critical";  // they lead you by 25+pp
  if (gap >= 10) return "warning";
  return "healthy";
}

const competitorWorkspace = defineWorkspace<Competitor>({
  kind: "competitor",
  slugParam: "slug",

  async loader({ slug }) {
    return await getCompetitorById(slug);
  },

  header: (c) => ({
    title: c.name,
    subtitle: c.domain ?? undefined,
    status: c.confirmed ? "Tracking" : "Awaiting review",
    statusTone: c.confirmed ? "accent" : "warning",
    health: healthFromGap(c.stats.vsYouGap7d),
    chips: [
      { label: "Brand", value: c.brand.name },
      { label: "Source", value: c.source === "ai_suggested" ? "AI-suggested" : "Manual" },
      { label: "Last seen", value: timeAgo(c.stats.lastMentionAt) },
    ],
  }),

  async summary(c) {
    const supabase = await createClient();
    const { data: prompts } = await supabase
      .from("prompts")
      .select("id")
      .eq("brand_id", c.brand_id)
      .limit(500);
    const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

    let mentions7 = 0;
    let mentionsPrev7 = 0;
    let mentions30 = 0;
    let positionsSum = 0;
    let positionsN = 0;
    let contested = 0; // both mentioned
    let themOnly = 0; // gap prompts

    if (promptIds.length > 0) {
      const { data: runs } = await supabase
        .from("visibility_runs")
        .select("run_at, brand_mentioned, competitor_mentions")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(1000);
      const rows =
        (runs as { run_at: string; brand_mentioned: boolean | null; competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null }[] | null) ??
        [];
      const now = Date.now();
      const week = 7 * 86_400_000;
      const nameLower = c.name.toLowerCase();

      for (const r of rows) {
        const t = now - new Date(r.run_at).getTime();
        if (t >= 30 * 86_400_000) continue;
        const hit = (r.competitor_mentions ?? []).find(
          (m) => m.mentioned && m.name.toLowerCase() === nameLower,
        );
        if (hit) {
          mentions30 += 1;
          if (hit.position != null && hit.position > 0) {
            positionsSum += hit.position;
            positionsN += 1;
          }
        }
        if (r.brand_mentioned === null) continue;
        if (t < week) {
          if (hit) {
            mentions7 += 1;
            if (r.brand_mentioned === true) contested += 1;
            else themOnly += 1;
          }
        } else if (t < 2 * week) {
          if (hit) mentionsPrev7 += 1;
        }
      }
    }

    const avgPos = positionsN > 0 ? +(positionsSum / positionsN).toFixed(1) : null;

    return [
      {
        key: "sov",
        label: "SoV last 7d",
        value: c.stats.shareOfVoice7d == null ? "—" : `${c.stats.shareOfVoice7d}%`,
        hint: `${mentions7} mentions this week`,
        href: `/dashboard/w/competitor/${c.id}/insights`,
      },
      {
        key: "gap",
        label: "Gap vs you",
        value: c.stats.vsYouGap7d == null ? "—" : `${c.stats.vsYouGap7d}pp`,
        hint: c.stats.vsYouGap7d != null && c.stats.vsYouGap7d > 0 ? "they lead" : "you lead",
        tone: c.stats.vsYouGap7d != null && c.stats.vsYouGap7d > 0 ? "negative" : "positive",
        href: `/dashboard/w/competitor/${c.id}/battlecard`,
      },
      {
        key: "gap-prompts",
        label: "Gap prompts",
        value: themOnly,
        hint: `${contested} contested, 7d`,
        href: `/dashboard/w/competitor/${c.id}/prompts`,
      },
      {
        key: "avg-pos",
        label: "Avg position",
        value: avgPos == null ? "—" : avgPos,
        hint: mentions30 > 0 ? `across ${mentions30} mentions, 30d` : "no mentions",
        href: `/dashboard/w/competitor/${c.id}/battlecard`,
      },
    ];
  },

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: c }) => (
        <>
          <CompetitorWorkspaceListeners competitorId={c.id} />
          <OverviewBody competitor={c} />
        </>
      ),
    },
    {
      key: "prompts",
      label: "Prompts",
      icon: MessageSquare,
      render: ({ object: c }) => (
        <>
          <CompetitorWorkspaceListeners competitorId={c.id} />
          <PromptsBody competitor={c} />
        </>
      ),
    },
    {
      key: "sources",
      label: "Sources",
      icon: Globe,
      render: ({ object: c }) => (
        <>
          <CompetitorWorkspaceListeners competitorId={c.id} />
          <SourcesBody competitor={c} />
        </>
      ),
    },
    {
      key: "battlecard",
      label: "Battlecard",
      icon: Shield,
      render: ({ object: c }) => (
        <>
          <CompetitorWorkspaceListeners competitorId={c.id} />
          <BattlecardBody competitor={c} />
        </>
      ),
    },
    {
      key: "history",
      label: "History",
      icon: History,
      render: ({ object: c }) => (
        <>
          <CompetitorWorkspaceListeners competitorId={c.id} />
          <HistoryBody competitor={c} />
        </>
      ),
    },
    {
      key: "insights",
      label: "Insights",
      icon: Sparkles,
      render: ({ object: c }) => (
        <>
          <CompetitorWorkspaceListeners competitorId={c.id} />
          <InsightsBody competitor={c} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: c }) => (
        <>
          <CompetitorWorkspaceListeners competitorId={c.id} />
          <CopilotBody competitor={c} />
        </>
      ),
    },
  ],

  timeline: (c) => ({
    async entries() {
      const supabase = await createClient();
      const { data: prompts } = await supabase
        .from("prompts")
        .select("id, text")
        .eq("brand_id", c.brand_id)
        .limit(500);
      const promptList = (prompts as { id: string; text: string }[] | null) ?? [];
      const promptText = new Map(promptList.map((p) => [p.id, p.text]));
      const promptIds = promptList.map((p) => p.id);
      if (promptIds.length === 0) return [];

      const [runsRes, enginesRes] = await Promise.all([
        supabase
          .from("visibility_runs")
          .select("id, run_at, prompt_id, engine_id, brand_mentioned, competitor_mentions")
          .in("prompt_id", promptIds)
          .order("run_at", { ascending: false })
          .limit(200),
        supabase.from("engines").select("id, name"),
      ]);
      const engineMap = new Map<string, string>();
      for (const e of (enginesRes.data as { id: string; name: string }[] | null) ?? []) {
        engineMap.set(e.id, e.name);
      }

      type R = {
        id: string;
        run_at: string;
        prompt_id: string;
        engine_id: string;
        brand_mentioned: boolean | null;
        competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
      };
      const nameLower = c.name.toLowerCase();
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      for (const r of (runsRes.data as R[] | null) ?? []) {
        const hit = (r.competitor_mentions ?? []).find(
          (m) => m.mentioned && m.name.toLowerCase() === nameLower,
        );
        if (!hit) continue;
        const engineName = (engineMap.get(r.engine_id) ?? "engine").replace(/_/g, " ");
        const prompt = promptText.get(r.prompt_id) ?? "prompt";
        const you = r.brand_mentioned === true;
        rows.push({
          id: `run-${r.id}`,
          at: r.run_at,
          kind: you ? "contested" : "gap",
          message: `${engineName} · ${you ? "contested" : "they won"} · ${prompt.slice(0, 50)}${prompt.length > 50 ? "…" : ""}`,
          href: `/dashboard/w/prompt/${r.prompt_id}/history?run=${r.id}`,
        });
      }
      return rows.slice(0, 60);
    },
  }),

  activity: (c) => ({
    async entries() {
      const supabase = await createClient();
      const { data: prompts } = await supabase
        .from("prompts")
        .select("id, text")
        .eq("brand_id", c.brand_id)
        .limit(500);
      const promptList = (prompts as { id: string; text: string }[] | null) ?? [];
      const promptText = new Map(promptList.map((p) => [p.id, p.text]));
      const promptIds = promptList.map((p) => p.id);
      if (promptIds.length === 0) return [];

      const { data: runs } = await supabase
        .from("visibility_runs")
        .select("id, run_at, prompt_id, brand_mentioned, competitor_mentions")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(30);
      const nameLower = c.name.toLowerCase();
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      for (const r of (runs as { id: string; run_at: string; prompt_id: string; brand_mentioned: boolean | null; competitor_mentions: { name: string; mentioned: boolean }[] | null }[] | null) ?? []) {
        const mentioned = (r.competitor_mentions ?? []).some(
          (m) => m.mentioned && m.name.toLowerCase() === nameLower,
        );
        if (!mentioned) continue;
        const prompt = promptText.get(r.prompt_id) ?? "prompt";
        rows.push({
          id: `run-${r.id}`,
          at: r.run_at,
          kind: r.brand_mentioned ? "contested" : "gap",
          message: `${prompt.slice(0, 60)}${prompt.length > 60 ? "…" : ""}`,
          href: `/dashboard/w/prompt/${r.prompt_id}/history?run=${r.id}`,
        });
        if (rows.length >= 10) break;
      }
      return rows;
    },
    // Feed stream doesn't yet accept competitorId; the server ignores
    // unknown query keys today so this URL is inert but honest.
    stream: { url: `/api/feed/stream?brandId=${c.brand_id}&competitorId=${c.id}` },
  }),

  related: (c) => ({
    async nodes() {
      const supabase = await createClient();
      const [siblingsRes, promptsRes] = await Promise.all([
        supabase
          .from("competitors")
          .select("id, name")
          .eq("brand_id", c.brand_id)
          .neq("id", c.id)
          .eq("confirmed", true)
          .limit(6),
        supabase
          .from("prompts")
          .select("id, text")
          .eq("brand_id", c.brand_id)
          .order("priority", { ascending: false })
          .limit(6),
      ]);

      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: c.brand.id, label: c.brand.name, relation: "belongs_to" });
      for (const s of (siblingsRes.data as { id: string; name: string }[] | null) ?? []) {
        nodes.push({ kind: "competitor", id: s.id, label: s.name, relation: "sibling" });
      }
      for (const p of (promptsRes.data as { id: string; text: string }[] | null) ?? []) {
        nodes.push({
          kind: "prompt",
          id: p.id,
          label: (p.text ?? "").slice(0, 60) || "prompt",
          relation: "battleground",
        });
      }
      return nodes;
    },
  }),

  quickActions: (c) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Check;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
      href?: string;
    }> = [];
    if (!c.confirmed) {
      actions.push({
        id: "confirm",
        label: "Confirm",
        icon: Check,
        keyboard: "c",
        variant: "primary",
        event: { name: "competitor:confirm", detail: { competitorId: c.id } },
      });
      actions.push({
        id: "reject",
        label: "Reject",
        icon: X,
        keyboard: "r",
        variant: "danger",
        event: { name: "competitor:reject", detail: { competitorId: c.id } },
      });
    } else {
      actions.push({
        id: "reject",
        label: "Stop tracking",
        icon: X,
        keyboard: "r",
        variant: "danger",
        event: { name: "competitor:reject", detail: { competitorId: c.id } },
      });
    }
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "competitor:share", detail: { competitorId: c.id } },
    });
    return actions;
  },

  copilotContext: (c) => ({
    kind: "competitor",
    id: c.id,
    label: c.name,
    summary: `Competitor "${c.name}" tracked against brand ${c.brand.name}. ${
      c.stats.shareOfVoice7d != null
        ? `${c.stats.shareOfVoice7d}% share of voice last 7d, gap vs you ${c.stats.vsYouGap7d ?? 0}pp.`
        : "No SoV data yet."
    }`,
    hints: [
      "Answer with real data from visibility_runs and citations only.",
      "Never invent competitor moves, positions, or citations.",
      "When drafting content, keep [ADD ...] placeholders for owner-only facts.",
    ],
  }),

  capabilities: {
    share: true,
    export: true,
    delete: false,
    api: true,
  },
});

export default competitorWorkspace;
