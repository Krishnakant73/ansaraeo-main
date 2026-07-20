// ============================================================
// Mission workspace loader + shape.
//
// Missions live in migration_021 (workflow core). Each mission has a
// title, objective, status, priority, optional linked_campaign_id and
// linked_sprint_id, and a task list keyed by mission_id. Approvals hang
// off individual tasks.
//
// getMissionById(id) — cookie-scoped, RLS-safe, null → 404. Embeds the
// parent brand + optional campaign so the header can link out, plus
// computed stats so KPI cards don't re-query.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type MissionStats = {
  taskCount: number;
  completedTasks: number;
  blockedTasks: number;
  inReviewTasks: number;
  overdueTasks: number;
  progressPct: number | null;      // 0..100
  pendingApprovals: number;
  lastActivityAt: string | null;
};

export type MissionBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string | null;
};

export type MissionCampaign = {
  id: string;
  name: string;
} | null;

export type Mission = {
  id: string;
  brand_id: string;
  title: string;
  objective: string | null;
  status: string;                  // active|on_hold|completed|cancelled
  priority: number;                // 1..5
  owner_id: string | null;
  due_date: string | null;
  linked_campaign_id: string | null;
  linked_sprint_id: string | null;
  created_at: string;
  updated_at: string;
  brand: MissionBrand;
  campaign: MissionCampaign;
  stats: MissionStats;
};

const BRAND_COLUMNS = "id, name, slug, domain, industry";

export async function getMissionById(id: string): Promise<Mission | null> {
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("missions")
    .select(
      "id, brand_id, title, objective, status, priority, owner_id, due_date, linked_campaign_id, linked_sprint_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!m) return null;

  const mission = m as Omit<Mission, "brand" | "campaign" | "stats">;

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", mission.brand_id)
    .maybeSingle();
  if (!brand) return null;

  let campaign: MissionCampaign = null;
  if (mission.linked_campaign_id) {
    const { data: c } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("id", mission.linked_campaign_id)
      .maybeSingle();
    campaign = (c as { id: string; name: string } | null) ?? null;
  }

  const stats = await loadMissionStats(id, supabase);

  return {
    ...mission,
    brand: brand as MissionBrand,
    campaign,
    stats,
  };
}

 
async function loadMissionStats(missionId: string, supabase: any): Promise<MissionStats> {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status, due_date, completed_at, updated_at")
    .eq("mission_id", missionId);
  const rows =
    (tasks as {
      id: string;
      status: string;
      due_date: string | null;
      completed_at: string | null;
      updated_at: string;
    }[] | null) ?? [];

  const completed = rows.filter((t) => t.status === "done").length;
  const blocked = rows.filter((t) => t.status === "blocked").length;
  const inReview = rows.filter((t) => t.status === "in_review").length;
  const progressPct = rows.length > 0 ? Math.round((completed / rows.length) * 100) : null;
  const now = Date.now();
  const overdue = rows.filter((t) => {
    if (t.status === "done" || t.status === "cancelled") return false;
    if (!t.due_date) return false;
    return new Date(t.due_date).getTime() < now;
  }).length;

  const taskIds = rows.map((t) => t.id);
  let pendingApprovals = 0;
  if (taskIds.length > 0) {
    const { data: aps } = await supabase
      .from("approvals")
      .select("id")
      .in("task_id", taskIds)
      .eq("status", "pending");
    pendingApprovals = ((aps as { id: string }[] | null) ?? []).length;
  }

  const activityIsos = rows.map((t) => t.updated_at).filter(Boolean);
  activityIsos.sort();
  const lastActivityAt = activityIsos.length > 0 ? activityIsos[activityIsos.length - 1] : null;

  return {
    taskCount: rows.length,
    completedTasks: completed,
    blockedTasks: blocked,
    inReviewTasks: inReview,
    overdueTasks: overdue,
    progressPct,
    pendingApprovals,
    lastActivityAt,
  };
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
