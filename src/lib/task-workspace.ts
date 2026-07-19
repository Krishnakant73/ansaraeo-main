// ============================================================
// Task workspace loader + shape.
//
// Tasks live in migration_021 (workflow core). Each task belongs to a
// mission (required) and optionally hangs off an opportunity or an
// automation. Approvals hang off tasks 1:many (a task may need admin
// sign-off before deploy).
//
// getTaskById(id) — cookie-scoped, RLS-safe, null → 404. Embeds the
// parent mission + brand so the header can link out, plus approvals
// list and computed stats so KPI cards don't re-query.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type TaskStats = {
  approvalsCount: number;
  pendingApprovals: number;
  ageInDays: number;
  isOverdue: boolean;
  daysUntilDue: number | null;
  hasVerification: boolean;
  verificationPassed: boolean | null;
};

export type TaskBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
};

export type TaskMission = {
  id: string;
  title: string;
  status: string;
  priority: number;
};

export type TaskApproval = {
  id: string;
  status: string;             // pending|approved|rejected
  approver_role: string;
  decided_at: string | null;
  note: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  mission_id: string;
  title: string;
  type: string;               // fix|content|approve|deploy|verify
  status: string;             // backlog|todo|in_progress|in_review|blocked|done|cancelled
  assignee_id: string | null;
  source_opportunity_id: string | null;
  source_automation_id: string | null;
  engine_action: Record<string, unknown>;
  verification_result: Record<string, unknown> | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  mission: TaskMission;
  brand: TaskBrand;
  approvals: TaskApproval[];
  stats: TaskStats;
};

const MISSION_COLUMNS = "id, brand_id, title, status, priority";
const BRAND_COLUMNS = "id, name, slug, domain";

export async function getTaskById(id: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tasks")
    .select(
      "id, mission_id, title, type, status, assignee_id, source_opportunity_id, source_automation_id, engine_action, verification_result, due_date, completed_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) return null;

  const task = t as Omit<Task, "mission" | "brand" | "approvals" | "stats">;

  const { data: mission } = await supabase
    .from("missions")
    .select(MISSION_COLUMNS)
    .eq("id", task.mission_id)
    .maybeSingle();
  if (!mission) return null;

  const missionRow = mission as {
    id: string;
    brand_id: string;
    title: string;
    status: string;
    priority: number;
  };

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", missionRow.brand_id)
    .maybeSingle();
  if (!brand) return null;

  const { data: aps } = await supabase
    .from("approvals")
    .select("id, status, approver_role, decided_at, note, created_at")
    .eq("task_id", id)
    .order("created_at", { ascending: false });

  const approvals = (aps as TaskApproval[] | null) ?? [];

  const stats = computeTaskStats(task, approvals);

  return {
    ...task,
    mission: {
      id: missionRow.id,
      title: missionRow.title,
      status: missionRow.status,
      priority: missionRow.priority,
    },
    brand: brand as TaskBrand,
    approvals,
    stats,
  };
}

function computeTaskStats(
  task: Omit<Task, "mission" | "brand" | "approvals" | "stats">,
  approvals: TaskApproval[],
): TaskStats {
  const pending = approvals.filter((a) => a.status === "pending").length;
  const ageMs = Date.now() - new Date(task.created_at).getTime();
  const ageInDays = Math.max(0, Math.floor(ageMs / 86_400_000));
  const now = Date.now();
  const dueTime = task.due_date ? new Date(task.due_date).getTime() : null;
  const isOverdue =
    dueTime != null && dueTime < now && task.status !== "done" && task.status !== "cancelled";
  const daysUntilDue =
    dueTime == null ? null : Math.ceil((dueTime - now) / 86_400_000);

  const vr = task.verification_result;
  const hasVerification = !!vr && Object.keys(vr).length > 0;
  // The `passed` key is the convention set by verify tasks; when missing,
  // we surface null (unknown) rather than false (which would imply a failure).
  const verificationPassed =
    hasVerification && vr && typeof (vr as { passed?: unknown }).passed === "boolean"
      ? Boolean((vr as { passed: boolean }).passed)
      : null;

  return {
    approvalsCount: approvals.length,
    pendingApprovals: pending,
    ageInDays,
    isOverdue,
    daysUntilDue,
    hasVerification,
    verificationPassed,
  };
}

export function statusTone(status: string): "neutral" | "accent" | "warning" | "danger" {
  switch (status) {
    case "done":
      return "accent";
    case "in_progress":
    case "in_review":
      return "accent";
    case "blocked":
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function typeLabel(type: string): string {
  switch (type) {
    case "fix":
      return "Fix";
    case "content":
      return "Content";
    case "approve":
      return "Approval";
    case "deploy":
      return "Deploy";
    case "verify":
      return "Verify";
    default:
      return type;
  }
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
