import {
  LayoutDashboard, ListChecks, TrendingDown, Activity, Bot,
  Play, CheckCircle2, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import { getSprintById, timeAgo, type Sprint } from "@/lib/sprint-workspace";

import OverviewBody from "./tabs/overview";
import MissionsBody from "./tabs/missions";
import BurndownBody from "./tabs/burndown";
import ActivityBody from "./tabs/activity";
import CopilotBody from "./tabs/copilot";
import SprintWorkspaceListeners from "./SprintWorkspaceListeners.client";

// ============================================================
// Sprint workspace descriptor. Sixth UWE kind. Missions live in a
// sprint via `linked_sprint_id`; every task rolls up through them.
// ============================================================

function healthFromSprint(s: Sprint): "healthy" | "warning" | "critical" | "unknown" {
  if (s.status === "completed") return "healthy";
  if (s.status === "planned") return "unknown";
  if (s.stats.onTrack === null) return "unknown";
  if (s.stats.daysRemaining != null && s.stats.daysRemaining < 0 && s.stats.progressPct !== 100) return "critical";
  return s.stats.onTrack ? "healthy" : "warning";
}

const sprintWorkspace = defineWorkspace<Sprint>({
  kind: "sprint",
  slugParam: "slug",

  async loader({ slug }) {
    return await getSprintById(slug);
  },

  header: (s) => ({
    title: s.name,
    subtitle: s.goal ?? undefined,
    status: s.status,
    statusTone:
      s.status === "active" ? "accent" : s.status === "planned" ? "warning" : "neutral",
    health: healthFromSprint(s),
    chips: [
      { label: "Brand", value: s.brand.name },
      ...(s.start_date && s.end_date
        ? [{ label: "Window", value: `${new Date(s.start_date).toLocaleDateString()} → ${new Date(s.end_date).toLocaleDateString()}` }]
        : []),
      ...(s.stats.daysRemaining != null
        ? [
            {
              label: "Days left",
              value:
                s.stats.daysRemaining >= 0
                  ? String(s.stats.daysRemaining)
                  : `${Math.abs(s.stats.daysRemaining)} over`,
            },
          ]
        : []),
      { label: "Missions", value: String(s.stats.missionCount) },
      { label: "Last activity", value: timeAgo(s.stats.lastActivityAt) },
    ],
  }),

  summary: (s) => [
    {
      key: "progress",
      label: "Progress",
      value: s.stats.progressPct == null ? "—" : `${s.stats.progressPct}%`,
      hint: `${s.stats.completedTasks} / ${s.stats.taskCount} tasks`,
      href: `/dashboard/w/sprint/${s.id}/burndown`,
    },
    {
      key: "expected",
      label: "Expected",
      value: s.stats.expectedProgressPct == null ? "—" : `${s.stats.expectedProgressPct}%`,
      hint:
        s.stats.progressPct != null && s.stats.expectedProgressPct != null
          ? `${s.stats.progressPct - s.stats.expectedProgressPct >= 0 ? "+" : ""}${s.stats.progressPct - s.stats.expectedProgressPct}pp vs actual`
          : "no dates set",
      tone: s.stats.onTrack === false ? "negative" : "positive",
    },
    {
      key: "missions",
      label: "Missions",
      value: s.stats.missionCount,
      hint: `${s.stats.activeMissions} active · ${s.stats.completedMissions} done`,
      href: `/dashboard/w/sprint/${s.id}/missions`,
    },
    {
      key: "days-left",
      label: "Days left",
      value:
        s.stats.daysRemaining == null
          ? "—"
          : s.stats.daysRemaining < 0
            ? `${Math.abs(s.stats.daysRemaining)} over`
            : s.stats.daysRemaining,
      hint: s.stats.daysTotal != null ? `${s.stats.daysTotal}d total` : "no end date",
      tone: s.stats.daysRemaining != null && s.stats.daysRemaining < 0 ? "negative" : undefined,
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: s }) => (
        <>
          <SprintWorkspaceListeners sprintId={s.id} />
          <OverviewBody sprint={s} />
        </>
      ),
    },
    {
      key: "missions",
      label: "Missions",
      icon: ListChecks,
      render: ({ object: s }) => (
        <>
          <SprintWorkspaceListeners sprintId={s.id} />
          <MissionsBody sprint={s} />
        </>
      ),
    },
    {
      key: "burndown",
      label: "Burndown",
      icon: TrendingDown,
      render: ({ object: s }) => (
        <>
          <SprintWorkspaceListeners sprintId={s.id} />
          <BurndownBody sprint={s} />
        </>
      ),
    },
    {
      key: "activity",
      label: "Activity",
      icon: Activity,
      render: ({ object: s }) => (
        <>
          <SprintWorkspaceListeners sprintId={s.id} />
          <ActivityBody sprint={s} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: s }) => (
        <>
          <SprintWorkspaceListeners sprintId={s.id} />
          <CopilotBody sprint={s} />
        </>
      ),
    },
  ],

  timeline: (s) => ({
    async entries() {
      const supabase = await createClient();
      const { data: missions } = await supabase
        .from("missions")
        .select("id, title, status, created_at, updated_at")
        .eq("linked_sprint_id", s.id);
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      rows.push({
        id: `s-${s.id}`,
        at: s.created_at,
        kind: "sprint",
        message: `Sprint created · ${s.name}`,
      });
      const missionRows =
        (missions as {
          id: string;
          title: string;
          status: string;
          created_at: string;
          updated_at: string;
        }[] | null) ?? [];
      for (const m of missionRows) {
        rows.push({
          id: `m-c-${m.id}`,
          at: m.created_at,
          kind: "mission",
          message: `Mission scheduled · ${m.title}`,
          href: `/dashboard/w/mission/${m.id}/overview`,
        });
        if (m.status === "completed") {
          rows.push({
            id: `m-d-${m.id}`,
            at: m.updated_at,
            kind: "mission",
            message: `Mission completed · ${m.title}`,
            href: `/dashboard/w/mission/${m.id}/overview`,
          });
        }
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 60);
    },
  }),

  activity: (s) => ({
    async entries() {
      const supabase = await createClient();
      const { data: missions } = await supabase
        .from("missions")
        .select("id, title, status, updated_at")
        .eq("linked_sprint_id", s.id)
        .order("updated_at", { ascending: false })
        .limit(10);
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      for (const m of (missions as { id: string; title: string; status: string; updated_at: string }[] | null) ?? []) {
        rows.push({
          id: `m-${m.id}`,
          at: m.updated_at,
          kind: "mission",
          message: `${m.title} · ${m.status.replace(/_/g, " ")}`,
          href: `/dashboard/w/mission/${m.id}/overview`,
        });
      }
      return rows;
    },
    stream: { url: `/api/feed/stream?brandId=${s.brand_id}&sprintId=${s.id}` },
  }),

  related: (s) => ({
    async nodes() {
      const supabase = await createClient();
      const [missionsRes, siblingsRes] = await Promise.all([
        supabase
          .from("missions")
          .select("id, title")
          .eq("linked_sprint_id", s.id)
          .limit(6),
        supabase
          .from("sprints")
          .select("id, name, status")
          .eq("brand_id", s.brand_id)
          .neq("id", s.id)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: s.brand.id, label: s.brand.name, relation: "belongs_to" });
      for (const m of (missionsRes.data as { id: string; title: string }[] | null) ?? []) {
        nodes.push({ kind: "mission", id: m.id, label: m.title, relation: "contains" });
      }
      for (const sib of (siblingsRes.data as { id: string; name: string; status: string }[] | null) ?? []) {
        nodes.push({ kind: "sprint", id: sib.id, label: `${sib.name} (${sib.status})`, relation: "sibling" });
      }
      return nodes;
    },
  }),

  quickActions: (s) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Play;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
    }> = [];
    if (s.status === "planned") {
      actions.push({
        id: "activate",
        label: "Start",
        icon: Play,
        keyboard: "a",
        variant: "primary",
        event: { name: "sprint:mark-status", detail: { sprintId: s.id, status: "active" } },
      });
    }
    if (s.status !== "completed") {
      actions.push({
        id: "complete",
        label: "Complete",
        icon: CheckCircle2,
        keyboard: "d",
        variant: "primary",
        event: { name: "sprint:mark-status", detail: { sprintId: s.id, status: "completed" } },
      });
    }
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "sprint:share", detail: { sprintId: s.id } },
    });
    return actions;
  },

  copilotContext: (s) => ({
    kind: "sprint",
    id: s.id,
    label: s.name,
    summary: `Sprint "${s.name}" for brand ${s.brand.name}. Status ${s.status}. ${s.stats.missionCount} missions, ${s.stats.taskCount} tasks (${s.stats.completedTasks} done).${s.stats.daysRemaining != null ? ` ${s.stats.daysRemaining >= 0 ? `${s.stats.daysRemaining}d left` : `${Math.abs(s.stats.daysRemaining)}d over`}.` : ""}${s.stats.onTrack != null ? ` ${s.stats.onTrack ? "On track." : "Behind pace."}` : ""}`,
    hints: [
      "Answer from real missions + tasks + sprint dates only.",
      "Never invent completions, velocity, or a schedule that doesn't exist.",
      "For content drafts, keep [ADD ...] placeholders.",
    ],
  }),

  capabilities: {
    share: true,
    export: true,
    delete: false,
    api: true,
  },
});

export default sprintWorkspace;
