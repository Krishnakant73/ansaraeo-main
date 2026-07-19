import {
  LayoutDashboard, ListChecks, LayoutGrid, Activity, Bot,
  Pause, Play, CheckCircle2, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import {
  getCampaignById, timeAgo, type Campaign,
} from "@/lib/campaign-workspace";

import OverviewBody from "./tabs/overview";
import MissionsBody from "./tabs/missions";
import TasksBody from "./tabs/tasks";
import ActivityBody from "./tabs/activity";
import CopilotBody from "./tabs/copilot";
import CampaignWorkspaceListeners from "./CampaignWorkspaceListeners.client";

// ============================================================
// Campaign workspace descriptor.
//
// Fourth UWE kind. Five tabs: overview · missions · tasks · activity
// · copilot. KPIs computed from missions + tasks tables. Quick actions
// bound to status transitions (active/paused/completed) via serializable
// events; the listener component POSTs to /api/campaigns/[id].
// ============================================================

function healthFromCampaign(c: Campaign): "healthy" | "warning" | "critical" | "unknown" {
  if (c.status === "completed") return "healthy";
  if (c.status === "paused") return "warning";
  if (c.stats.taskCount === 0) return "unknown";
  if (c.stats.overdueTasks > 3) return "critical";
  if (c.stats.overdueTasks > 0) return "warning";
  return "healthy";
}

const campaignWorkspace = defineWorkspace<Campaign>({
  kind: "campaign",
  slugParam: "slug",

  async loader({ slug }) {
    return await getCampaignById(slug);
  },

  header: (c) => ({
    title: c.name,
    subtitle: c.objective ?? undefined,
    status: c.status,
    statusTone:
      c.status === "active" ? "accent" : c.status === "paused" ? "warning" : "neutral",
    health: healthFromCampaign(c),
    chips: [
      { label: "Brand", value: c.brand.name },
      { label: "Missions", value: String(c.stats.missionCount) },
      { label: "Last activity", value: timeAgo(c.stats.lastActivityAt) },
    ],
  }),

  summary: (c) => [
    {
      key: "progress",
      label: "Progress",
      value: c.stats.progressPct == null ? "—" : `${c.stats.progressPct}%`,
      hint: `${c.stats.completedTasks} / ${c.stats.taskCount} tasks done`,
      href: `/dashboard/w/campaign/${c.id}/tasks`,
    },
    {
      key: "missions",
      label: "Missions",
      value: c.stats.missionCount,
      hint: `${c.stats.activeMissions} active · ${c.stats.completedMissions} done`,
      href: `/dashboard/w/campaign/${c.id}/missions`,
    },
    {
      key: "overdue",
      label: "Overdue tasks",
      value: c.stats.overdueTasks,
      hint: c.stats.overdueTasks > 0 ? "needs attention" : "on track",
      tone: c.stats.overdueTasks > 0 ? "negative" : "positive",
      href: `/dashboard/w/campaign/${c.id}/tasks`,
    },
    {
      key: "status",
      label: "Status",
      value: c.status,
      hint: `Campaign is ${c.status}`,
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: c }) => (
        <>
          <CampaignWorkspaceListeners campaignId={c.id} />
          <OverviewBody campaign={c} />
        </>
      ),
    },
    {
      key: "missions",
      label: "Missions",
      icon: ListChecks,
      render: ({ object: c }) => (
        <>
          <CampaignWorkspaceListeners campaignId={c.id} />
          <MissionsBody campaign={c} />
        </>
      ),
    },
    {
      key: "tasks",
      label: "Tasks",
      icon: LayoutGrid,
      render: ({ object: c }) => (
        <>
          <CampaignWorkspaceListeners campaignId={c.id} />
          <TasksBody campaign={c} />
        </>
      ),
    },
    {
      key: "activity",
      label: "Activity",
      icon: Activity,
      render: ({ object: c }) => (
        <>
          <CampaignWorkspaceListeners campaignId={c.id} />
          <ActivityBody campaign={c} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: c }) => (
        <>
          <CampaignWorkspaceListeners campaignId={c.id} />
          <CopilotBody campaign={c} />
        </>
      ),
    },
  ],

  timeline: (c) => ({
    async entries() {
      const supabase = await createClient();
      const { data: missions } = await supabase
        .from("missions")
        .select("id, title, status, created_at, updated_at")
        .eq("linked_campaign_id", c.id);
      const missionRows =
        (missions as {
          id: string;
          title: string;
          status: string;
          created_at: string;
          updated_at: string;
        }[] | null) ?? [];
      const missionIds = missionRows.map((m) => m.id);
      const missionTitles = new Map(missionRows.map((m) => [m.id, m.title]));

      let taskRows: {
        id: string;
        mission_id: string;
        title: string;
        completed_at: string | null;
        created_at: string;
        status: string;
      }[] = [];
      if (missionIds.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, mission_id, title, completed_at, created_at, status")
          .in("mission_id", missionIds)
          .order("updated_at", { ascending: false })
          .limit(50);
        taskRows =
          (tasks as {
            id: string;
            mission_id: string;
            title: string;
            completed_at: string | null;
            created_at: string;
            status: string;
          }[] | null) ?? [];
      }

      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      for (const m of missionRows) {
        rows.push({
          id: `m-c-${m.id}`,
          at: m.created_at,
          kind: "mission",
          message: `Mission created · ${m.title}`,
        });
        if (m.status === "completed") {
          rows.push({
            id: `m-d-${m.id}`,
            at: m.updated_at,
            kind: "mission",
            message: `Mission completed · ${m.title}`,
          });
        }
      }
      for (const t of taskRows) {
        if (t.completed_at) {
          rows.push({
            id: `t-d-${t.id}`,
            at: t.completed_at,
            kind: "task",
            message: `${t.title} · done`,
          });
        }
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 60);
    },
  }),

  activity: (c) => ({
    async entries() {
      const supabase = await createClient();
      const { data: missions } = await supabase
        .from("missions")
        .select("id, title, status, updated_at")
        .eq("linked_campaign_id", c.id)
        .order("updated_at", { ascending: false })
        .limit(5);
      const missionRows =
        (missions as { id: string; title: string; status: string; updated_at: string }[] | null) ?? [];
      const missionIds = missionRows.map((m) => m.id);
      let taskRows: { id: string; title: string; updated_at: string; status: string; mission_id: string }[] = [];
      if (missionIds.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, updated_at, status, mission_id")
          .in("mission_id", missionIds)
          .order("updated_at", { ascending: false })
          .limit(5);
        taskRows =
          (tasks as { id: string; title: string; updated_at: string; status: string; mission_id: string }[] | null) ??
          [];
      }
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      for (const m of missionRows) {
        rows.push({
          id: `m-${m.id}`,
          at: m.updated_at,
          kind: "mission",
          message: `${m.title} · ${m.status.replace(/_/g, " ")}`,
        });
      }
      for (const t of taskRows) {
        rows.push({
          id: `t-${t.id}`,
          at: t.updated_at,
          kind: "task",
          message: `${t.title} · ${t.status.replace(/_/g, " ")}`,
        });
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 10);
    },
    stream: {
      url: `/api/feed/stream?brandId=${c.brand_id}&campaignId=${c.id}&kinds=task.completed,alert.fired`,
    },
  }),

  related: (c) => ({
    async nodes() {
      const supabase = await createClient();
      const [missionsRes, siblingsRes] = await Promise.all([
        supabase
          .from("missions")
          .select("id, title")
          .eq("linked_campaign_id", c.id)
          .limit(6),
        supabase
          .from("campaigns")
          .select("id, name")
          .eq("brand_id", c.brand_id)
          .neq("id", c.id)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: c.brand.id, label: c.brand.name, relation: "belongs_to" });
      for (const m of (missionsRes.data as { id: string; title: string }[] | null) ?? []) {
        // Missions aren't a workspace yet; link to Mission Control's task board.
        nodes.push({ kind: "mission", id: m.id, label: m.title, relation: "contains" });
      }
      for (const s of (siblingsRes.data as { id: string; name: string }[] | null) ?? []) {
        nodes.push({ kind: "campaign", id: s.id, label: s.name, relation: "sibling" });
      }
      return nodes;
    },
  }),

  quickActions: (c) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Play;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
      href?: string;
    }> = [];
    if (c.status !== "active") {
      actions.push({
        id: "activate",
        label: "Activate",
        icon: Play,
        keyboard: "a",
        variant: "primary",
        event: { name: "campaign:mark-status", detail: { campaignId: c.id, status: "active" } },
      });
    }
    if (c.status === "active") {
      actions.push({
        id: "pause",
        label: "Pause",
        icon: Pause,
        keyboard: "p",
        event: { name: "campaign:mark-status", detail: { campaignId: c.id, status: "paused" } },
      });
    }
    if (c.status !== "completed") {
      actions.push({
        id: "complete",
        label: "Complete",
        icon: CheckCircle2,
        keyboard: "d",
        variant: "primary",
        event: { name: "campaign:mark-status", detail: { campaignId: c.id, status: "completed" } },
      });
    }
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "campaign:share", detail: { campaignId: c.id } },
    });
    return actions;
  },

  copilotContext: (c) => ({
    kind: "campaign",
    id: c.id,
    label: c.name,
    summary: `Campaign "${c.name}" for brand ${c.brand.name}. Status ${c.status}. ${c.stats.missionCount} missions, ${c.stats.taskCount} tasks (${c.stats.completedTasks} done${c.stats.overdueTasks > 0 ? `, ${c.stats.overdueTasks} overdue` : ""}).`,
    hints: [
      "Answer from real missions + tasks data only.",
      "Never invent task completions, deadlines, or dependencies.",
      "For content drafts, ship [ADD ...] placeholders.",
    ],
  }),

  capabilities: {
    share: true,
    export: true,
    delete: false,
    api: true,
  },
});

export default campaignWorkspace;
