// ============================================================
// Campaign workspace loader + shape.
//
// getCampaignById(id) — cookie-scoped resolver mirroring the Brand /
// Prompt / Competitor loaders. Reads the campaign, embeds its parent
// brand, and computes lightweight stats (mission count, task
// completion, progress percent) so the header + KPI cards don't
// re-query. RLS filters unauthorized reads → null → 404.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type CampaignStats = {
  missionCount: number;
  activeMissions: number;
  completedMissions: number;
  taskCount: number;
  completedTasks: number;
  progressPct: number | null;   // 0..100, null when nothing to track yet
  overdueTasks: number;
  lastActivityAt: string | null;
};

export type CampaignBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string | null;
};

export type Campaign = {
  id: string;
  brand_id: string;
  name: string;
  objective: string | null;
  status: string;              // active|paused|completed
  created_at: string;
  brand: CampaignBrand;
  stats: CampaignStats;
};

const BRAND_COLUMNS = "id, name, slug, domain, industry";

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data: camp } = await supabase
    .from("campaigns")
    .select("id, brand_id, name, objective, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!camp) return null;

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", (camp as { brand_id: string }).brand_id)
    .maybeSingle();
  if (!brand) return null;

  const stats = await loadCampaignStats(id, supabase);

  return {
    ...(camp as Omit<Campaign, "brand" | "stats">),
    brand: brand as CampaignBrand,
    stats,
  };
}

 
async function loadCampaignStats(campaignId: string, supabase: any): Promise<CampaignStats> {
  const { data: missions } = await supabase
    .from("missions")
    .select("id, status, updated_at")
    .eq("linked_campaign_id", campaignId);
  const missionRows =
    (missions as { id: string; status: string; updated_at: string }[] | null) ?? [];
  if (missionRows.length === 0) {
    return {
      missionCount: 0,
      activeMissions: 0,
      completedMissions: 0,
      taskCount: 0,
      completedTasks: 0,
      progressPct: null,
      overdueTasks: 0,
      lastActivityAt: null,
    };
  }
  const missionIds = missionRows.map((m) => m.id);
  const activeMissions = missionRows.filter((m) => m.status === "active").length;
  const completedMissions = missionRows.filter((m) => m.status === "completed").length;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status, due_date, completed_at, updated_at")
    .in("mission_id", missionIds);
  const taskRows =
    (tasks as {
      id: string;
      status: string;
      due_date: string | null;
      completed_at: string | null;
      updated_at: string;
    }[] | null) ?? [];

  const completedTasks = taskRows.filter((t) => t.status === "done").length;
  const progressPct =
    taskRows.length > 0 ? Math.round((completedTasks / taskRows.length) * 100) : null;
  const now = Date.now();
  const overdueTasks = taskRows.filter((t) => {
    if (t.status === "done" || t.status === "cancelled") return false;
    if (!t.due_date) return false;
    return new Date(t.due_date).getTime() < now;
  }).length;

  // Last activity = newest updated_at across missions + tasks.
  const activityIsos = [
    ...missionRows.map((m) => m.updated_at),
    ...taskRows.map((t) => t.updated_at),
  ].filter(Boolean);
  activityIsos.sort();
  const lastActivityAt = activityIsos.length > 0 ? activityIsos[activityIsos.length - 1] : null;

  return {
    missionCount: missionRows.length,
    activeMissions,
    completedMissions,
    taskCount: taskRows.length,
    completedTasks,
    progressPct,
    overdueTasks,
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
