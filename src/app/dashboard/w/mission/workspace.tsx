import {
  LayoutDashboard, LayoutGrid, ShieldCheck, Activity, Bot,
  Pause, Play, CheckCircle2, Ban, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import {
  getMissionById, timeAgo, type Mission,
} from "@/lib/mission-workspace";

import OverviewBody from "./tabs/overview";
import TasksBody from "./tabs/tasks";
import ApprovalsBody from "./tabs/approvals";
import ActivityBody from "./tabs/activity";
import CopilotBody from "./tabs/copilot";
import MissionWorkspaceListeners from "./MissionWorkspaceListeners.client";

// ============================================================
// Mission workspace descriptor.
//
// Fifth UWE kind. Missions are the "objective container" for tasks
// in the workflow model (migration_021). Five tabs: overview · tasks
// · approvals · activity · copilot. KPIs computed from tasks +
// approvals. Quick actions bind status transitions
// (active/on_hold/completed/cancelled) via serializable events.
// ============================================================

function healthFromMission(m: Mission): "healthy" | "warning" | "critical" | "unknown" {
  if (m.status === "completed") return "healthy";
  if (m.status === "cancelled") return "unknown";
  if (m.status === "on_hold") return "warning";
  if (m.stats.taskCount === 0) return "unknown";
  if (m.stats.blockedTasks > 0 || m.stats.overdueTasks > 2) return "critical";
  if (m.stats.overdueTasks > 0) return "warning";
  return "healthy";
}

const missionWorkspace = defineWorkspace<Mission>({
  kind: "mission",
  slugParam: "slug",

  async loader({ slug }) {
    return await getMissionById(slug);
  },

  header: (m) => ({
    title: m.title,
    subtitle: m.objective ?? undefined,
    status: m.status.replace(/_/g, " "),
    statusTone:
      m.status === "active"
        ? "accent"
        : m.status === "on_hold"
          ? "warning"
          : m.status === "completed"
            ? "neutral"
            : "danger",
    health: healthFromMission(m),
    chips: [
      { label: "Brand", value: m.brand.name },
      ...(m.campaign ? [{ label: "Campaign", value: m.campaign.name }] : []),
      { label: "Priority", value: `P${m.priority}` },
      { label: "Updated", value: timeAgo(m.updated_at) },
    ],
  }),

  summary: (m) => [
    {
      key: "progress",
      label: "Progress",
      value: m.stats.progressPct == null ? "—" : `${m.stats.progressPct}%`,
      hint: `${m.stats.completedTasks} / ${m.stats.taskCount} tasks`,
      href: `/dashboard/w/mission/${m.id}/tasks`,
    },
    {
      key: "blocked",
      label: "Blocked",
      value: m.stats.blockedTasks,
      hint: m.stats.blockedTasks > 0 ? "unblock or reassign" : "nothing blocked",
      tone: m.stats.blockedTasks > 0 ? "negative" : "positive",
      href: `/dashboard/w/mission/${m.id}/tasks`,
    },
    {
      key: "approvals",
      label: "Pending approvals",
      value: m.stats.pendingApprovals,
      hint: m.stats.pendingApprovals > 0 ? "awaiting sign-off" : "clear",
      tone: m.stats.pendingApprovals > 0 ? "negative" : "positive",
      href: `/dashboard/w/mission/${m.id}/approvals`,
    },
    {
      key: "overdue",
      label: "Overdue tasks",
      value: m.stats.overdueTasks,
      hint: m.stats.overdueTasks > 0 ? "past due date" : "on schedule",
      tone: m.stats.overdueTasks > 0 ? "negative" : "positive",
      href: `/dashboard/w/mission/${m.id}/tasks`,
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: m }) => (
        <>
          <MissionWorkspaceListeners missionId={m.id} />
          <OverviewBody mission={m} />
        </>
      ),
    },
    {
      key: "tasks",
      label: "Tasks",
      icon: LayoutGrid,
      render: ({ object: m }) => (
        <>
          <MissionWorkspaceListeners missionId={m.id} />
          <TasksBody mission={m} />
        </>
      ),
    },
    {
      key: "approvals",
      label: "Approvals",
      icon: ShieldCheck,
      render: ({ object: m }) => (
        <>
          <MissionWorkspaceListeners missionId={m.id} />
          <ApprovalsBody mission={m} />
        </>
      ),
    },
    {
      key: "activity",
      label: "Activity",
      icon: Activity,
      render: ({ object: m }) => (
        <>
          <MissionWorkspaceListeners missionId={m.id} />
          <ActivityBody mission={m} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: m }) => (
        <>
          <MissionWorkspaceListeners missionId={m.id} />
          <CopilotBody mission={m} />
        </>
      ),
    },
  ],

  timeline: (m) => ({
    async entries() {
      const supabase = await createClient();
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, created_at, completed_at")
        .eq("mission_id", m.id);
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      rows.push({
        id: `m-${m.id}`,
        at: m.created_at,
        kind: "mission",
        message: `Mission created · ${m.title}`,
      });
      for (const t of (tasks as { id: string; title: string; status: string; created_at: string; completed_at: string | null }[] | null) ?? []) {
        rows.push({
          id: `t-c-${t.id}`,
          at: t.created_at,
          kind: "task",
          message: `Task created · ${t.title}`,
        });
        if (t.completed_at) {
          rows.push({
            id: `t-d-${t.id}`,
            at: t.completed_at,
            kind: "task",
            message: `Task done · ${t.title}`,
          });
        }
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 60);
    },
  }),

  activity: (m) => ({
    async entries() {
      const supabase = await createClient();
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, updated_at")
        .eq("mission_id", m.id)
        .order("updated_at", { ascending: false })
        .limit(10);
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      for (const t of (tasks as { id: string; title: string; status: string; updated_at: string }[] | null) ?? []) {
        rows.push({
          id: `t-${t.id}`,
          at: t.updated_at,
          kind: "task",
          message: `${t.title} · ${t.status.replace(/_/g, " ")}`,
        });
      }
      return rows;
    },
    stream: {
      url: `/api/feed/stream?brandId=${m.brand_id}&missionId=${m.id}&kinds=task.completed,alert.fired`,
    },
  }),

  related: (m) => ({
    async nodes() {
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: m.brand.id, label: m.brand.name, relation: "belongs_to" });
      if (m.campaign) {
        nodes.push({
          kind: "campaign",
          id: m.campaign.id,
          label: m.campaign.name,
          relation: "part_of",
        });
      }
      const supabase = await createClient();
      const { data: siblings } = await supabase
        .from("missions")
        .select("id, title")
        .eq("brand_id", m.brand_id)
        .neq("id", m.id)
        .order("updated_at", { ascending: false })
        .limit(4);
      for (const s of (siblings as { id: string; title: string }[] | null) ?? []) {
        nodes.push({ kind: "mission", id: s.id, label: s.title, relation: "sibling" });
      }
      return nodes;
    },
  }),

  quickActions: (m) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Play;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
    }> = [];
    if (m.status !== "active") {
      actions.push({
        id: "activate",
        label: "Activate",
        icon: Play,
        keyboard: "a",
        variant: "primary",
        event: { name: "mission:mark-status", detail: { missionId: m.id, status: "active" } },
      });
    }
    if (m.status === "active") {
      actions.push({
        id: "hold",
        label: "Hold",
        icon: Pause,
        keyboard: "h",
        event: { name: "mission:mark-status", detail: { missionId: m.id, status: "on_hold" } },
      });
    }
    if (m.status !== "completed" && m.status !== "cancelled") {
      actions.push({
        id: "complete",
        label: "Complete",
        icon: CheckCircle2,
        keyboard: "d",
        variant: "primary",
        event: { name: "mission:mark-status", detail: { missionId: m.id, status: "completed" } },
      });
      actions.push({
        id: "cancel",
        label: "Cancel",
        icon: Ban,
        keyboard: "x",
        variant: "danger",
        event: { name: "mission:mark-status", detail: { missionId: m.id, status: "cancelled" } },
      });
    }
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "mission:share", detail: { missionId: m.id } },
    });
    return actions;
  },

  copilotContext: (m) => ({
    kind: "mission",
    id: m.id,
    label: m.title,
    summary: `Mission "${m.title}" for brand ${m.brand.name}${m.campaign ? ` under campaign ${m.campaign.name}` : ""}. Status ${m.status}, priority P${m.priority}. ${m.stats.taskCount} tasks (${m.stats.completedTasks} done${m.stats.blockedTasks > 0 ? `, ${m.stats.blockedTasks} blocked` : ""}${m.stats.pendingApprovals > 0 ? `, ${m.stats.pendingApprovals} approval${m.stats.pendingApprovals === 1 ? "" : "s"} pending` : ""}).`,
    hints: [
      "Answer from real tasks + approvals data only.",
      "Never invent completions, blockers, deadlines, or approvers.",
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

export default missionWorkspace;
