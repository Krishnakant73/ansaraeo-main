import {
  LayoutDashboard, ShieldCheck, Bot, ShieldQuestion,
  Play, Pause, CheckCircle2, Ban, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import {
  getTaskById, timeAgo, typeLabel, type Task,
  type TaskStats,
} from "@/lib/task-workspace";

import OverviewBody from "./tabs/overview";
import ApprovalsBody from "./tabs/approvals";
import VerificationBody from "./tabs/verification";
import CopilotBody from "./tabs/copilot";
import TaskWorkspaceListeners from "./TaskWorkspaceListeners.client";

// ============================================================
// Task workspace descriptor.
//
// Thirteenth UWE kind. A task is the atomic unit of work under a
// mission (migration_021). Four tabs: overview · approvals ·
// verification · copilot. Quick actions bind status transitions and
// share; the verify task type gets a dedicated verification body
// showing the diff against the pre-fix baseline.
// ============================================================

function healthFromTask(t: Task): "healthy" | "warning" | "critical" | "unknown" {
  if (t.status === "done") return "healthy";
  if (t.status === "cancelled") return "unknown";
  if (t.status === "blocked") return "critical";
  if (t.stats.isOverdue) return "critical";
  if (t.stats.pendingApprovals > 0) return "warning";
  if (t.type === "verify" && t.stats.hasVerification && t.stats.verificationPassed === false) return "critical";
  return "healthy";
}

function dueDaysHint(stats: TaskStats): string {
  if (stats.daysUntilDue == null) return "no due date";
  if (stats.daysUntilDue < 0) return `${Math.abs(stats.daysUntilDue)}d overdue`;
  if (stats.daysUntilDue === 0) return "due today";
  return `${stats.daysUntilDue}d left`;
}

const taskWorkspace = defineWorkspace<Task>({
  kind: "task",
  slugParam: "slug",

  async loader({ slug }) {
    return await getTaskById(slug);
  },

  header: (t) => ({
    title: t.title,
    subtitle: `${typeLabel(t.type)} · mission: ${t.mission.title}`,
    status: t.status.replace(/_/g, " "),
    statusTone:
      t.status === "done"
        ? "accent"
        : t.status === "blocked"
          ? "danger"
          : t.status === "cancelled"
            ? "neutral"
            : t.status === "in_progress" || t.status === "in_review"
              ? "accent"
              : "neutral",
    health: healthFromTask(t),
    chips: [
      { label: "Brand", value: t.brand.name },
      { label: "Mission", value: t.mission.title },
      { label: "Type", value: typeLabel(t.type) },
      { label: "Updated", value: timeAgo(t.updated_at) },
    ],
  }),

  summary: (t) => [
    {
      key: "status",
      label: "Status",
      value: t.status.replace(/_/g, " "),
      hint:
        t.status === "done"
          ? "closed"
          : t.status === "blocked"
            ? "needs unblocking"
            : "in flight",
      tone:
        t.status === "done"
          ? "positive"
          : t.status === "blocked"
            ? "negative"
            : undefined,
    },
    {
      key: "due",
      label: "Due",
      value:
        t.stats.daysUntilDue == null
          ? "—"
          : t.stats.daysUntilDue < 0
            ? `${Math.abs(t.stats.daysUntilDue)}d over`
            : t.stats.daysUntilDue,
      hint: dueDaysHint(t.stats),
      tone: t.stats.isOverdue ? "negative" : undefined,
    },
    {
      key: "approvals",
      label: "Approvals pending",
      value: t.stats.pendingApprovals,
      hint: t.stats.pendingApprovals > 0 ? "awaiting sign-off" : "clear",
      tone: t.stats.pendingApprovals > 0 ? "negative" : "positive",
      href: `/dashboard/w/task/${t.id}/approvals`,
    },
    {
      key: "verify",
      label: "Verify",
      value:
        t.type !== "verify"
          ? "—"
          : !t.stats.hasVerification
            ? "pending"
            : t.stats.verificationPassed === true
              ? "passed"
              : t.stats.verificationPassed === false
                ? "failed"
                : "ran",
      hint: t.type === "verify" ? "diff vs baseline" : "not a verify task",
      tone:
        t.type === "verify" && t.stats.verificationPassed === true
          ? "positive"
          : t.type === "verify" && t.stats.verificationPassed === false
            ? "negative"
            : undefined,
      href: `/dashboard/w/task/${t.id}/verification`,
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: t }) => (
        <>
          <TaskWorkspaceListeners taskId={t.id} />
          <OverviewBody task={t} />
        </>
      ),
    },
    {
      key: "approvals",
      label: "Approvals",
      icon: ShieldCheck,
      render: ({ object: t }) => (
        <>
          <TaskWorkspaceListeners taskId={t.id} />
          <ApprovalsBody task={t} />
        </>
      ),
    },
    {
      key: "verification",
      label: "Verification",
      icon: ShieldQuestion,
      render: ({ object: t }) => (
        <>
          <TaskWorkspaceListeners taskId={t.id} />
          <VerificationBody task={t} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: t }) => (
        <>
          <TaskWorkspaceListeners taskId={t.id} />
          <CopilotBody task={t} />
        </>
      ),
    },
  ],

  timeline: (t) => ({
    async entries() {
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      rows.push({
        id: `t-c-${t.id}`,
        at: t.created_at,
        kind: "task",
        message: `Task created`,
      });
      if (t.completed_at) {
        rows.push({
          id: `t-d-${t.id}`,
          at: t.completed_at,
          kind: "task",
          message: `Task marked done`,
        });
      }
      for (const a of t.approvals) {
        rows.push({
          id: `a-c-${a.id}`,
          at: a.created_at,
          kind: "approval",
          message: `Approval requested · ${a.approver_role}`,
        });
        if (a.decided_at) {
          rows.push({
            id: `a-d-${a.id}`,
            at: a.decided_at,
            kind: "approval",
            message: `Approval ${a.status} · ${a.approver_role}`,
          });
        }
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 40);
    },
  }),

  activity: (t) => ({
    async entries() {
      const rows: { id: string; at: string; kind: string; message: string }[] = [];
      rows.push({
        id: `u-${t.id}`,
        at: t.updated_at,
        kind: "task",
        message: `${t.title} · ${t.status.replace(/_/g, " ")}`,
      });
      return rows;
    },
  }),

  related: (t) => ({
    async nodes() {
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: t.brand.id, label: t.brand.name, relation: "belongs_to" });
      nodes.push({ kind: "mission", id: t.mission.id, label: t.mission.title, relation: "part_of" });
      if (t.source_opportunity_id) {
        nodes.push({
          kind: "opportunity",
          id: t.source_opportunity_id,
          label: "Source opportunity",
          relation: "sourced_from",
        });
      }
      if (t.source_automation_id) {
        nodes.push({
          kind: "automation",
          id: t.source_automation_id,
          label: "Source automation",
          relation: "created_by",
        });
      }
      // Sibling tasks: other tasks in the same mission.
      const supabase = await createClient();
      const { data: siblings } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("mission_id", t.mission_id)
        .neq("id", t.id)
        .order("updated_at", { ascending: false })
        .limit(4);
      for (const s of (siblings as { id: string; title: string }[] | null) ?? []) {
        nodes.push({ kind: "task", id: s.id, label: s.title, relation: "sibling" });
      }
      return nodes;
    },
  }),

  quickActions: (t) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Play;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
      href?: string;
    }> = [];
    if (t.status !== "in_progress" && t.status !== "done" && t.status !== "cancelled") {
      actions.push({
        id: "start",
        label: "Start",
        icon: Play,
        keyboard: "s",
        variant: "primary",
        event: { name: "task:mark-status", detail: { taskId: t.id, status: "in_progress" } },
      });
    }
    if (t.status === "in_progress") {
      actions.push({
        id: "review",
        label: "Move to review",
        icon: Pause,
        keyboard: "v",
        event: { name: "task:mark-status", detail: { taskId: t.id, status: "in_review" } },
      });
    }
    if (t.status !== "done" && t.status !== "cancelled") {
      actions.push({
        id: "done",
        label: "Mark done",
        icon: CheckCircle2,
        keyboard: "d",
        variant: "primary",
        event: { name: "task:mark-status", detail: { taskId: t.id, status: "done" } },
      });
    }
    if (t.status !== "cancelled" && t.status !== "done") {
      actions.push({
        id: "cancel",
        label: "Cancel",
        icon: Ban,
        keyboard: "x",
        variant: "danger",
        event: { name: "task:mark-status", detail: { taskId: t.id, status: "cancelled" } },
      });
    }
    actions.push({
      id: "open-mission",
      label: "Open mission",
      icon: LayoutDashboard,
      keyboard: "m",
      href: `/dashboard/w/mission/${t.mission.id}/tasks`,
    });
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "c",
      event: { name: "task:share", detail: { taskId: t.id } },
    });
    return actions;
  },

  copilotContext: (t) => ({
    kind: "task",
    id: t.id,
    label: t.title,
    summary: `Task "${t.title}" (${typeLabel(t.type)}) inside mission "${t.mission.title}" for brand ${t.brand.name}. Status ${t.status}${t.stats.isOverdue ? " · overdue" : ""}${t.stats.pendingApprovals > 0 ? ` · ${t.stats.pendingApprovals} pending approval(s)` : ""}.`,
    hints: [
      "Answer from the task row + approvals + verification_result only.",
      "Never invent blockers, approvers, or engine responses.",
      "For verify tasks, be honest: pass/fail is what verification_result says.",
    ],
  }),

  async list({ limit }) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tasks")
      .select("id, title, type, status")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    return ((data as { id: string; title: string; type: string; status: string }[] | null) ?? []).map(
      (t) => ({
        id: t.id,
        label: t.title,
        sublabel: `${typeLabel(t.type)} · ${t.status.replace(/_/g, " ")}`,
      }),
    );
  },

  capabilities: {
    share: true,
    export: false,
    delete: false,
    api: true,
  },
});

export default taskWorkspace;
