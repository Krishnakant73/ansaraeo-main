// ============================================================
// Sprint workspace loader + shape.
//
// Sprints (migration_021) are time-boxed containers for missions. A
// mission optionally links to a sprint via `linked_sprint_id`. Sprints
// have a start_date and end_date, so the workspace can render burndown
// against the window.
//
// getSprintById(id) — cookie client, RLS-safe, null → 404. Embeds the
// parent brand + computed stats (mission count, task progress, days
// remaining, on-track flag) so KPI cards render without re-querying.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type SprintStats = {
  missionCount: number;
  activeMissions: number;
  completedMissions: number;
  taskCount: number;
  completedTasks: number;
  progressPct: number | null;         // 0..100 of tasks done
  daysTotal: number | null;
  daysElapsed: number | null;
  daysRemaining: number | null;       // negative if past end_date
  expectedProgressPct: number | null; // linear expectation vs elapsed time
  onTrack: boolean | null;            // progress vs expected within 15pp
  lastActivityAt: string | null;
};

export type SprintBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string | null;
};

export type Sprint = {
  id: string;
  brand_id: string;
  name: string;
  goal: string | null;
  start_date: string | null;   // date string
  end_date: string | null;
  status: string;              // planned|active|completed
  created_at: string;
  brand: SprintBrand;
  stats: SprintStats;
};

const BRAND_COLUMNS = "id, name, slug, domain, industry";

export async function getSprintById(id: string): Promise<Sprint | null> {
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sprints")
    .select("id, brand_id, name, goal, start_date, end_date, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!s) return null;

  const sprint = s as Omit<Sprint, "brand" | "stats">;
  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", sprint.brand_id)
    .maybeSingle();
  if (!brand) return null;

  const stats = await loadSprintStats(id, sprint.start_date, sprint.end_date, supabase);
  return { ...sprint, brand: brand as SprintBrand, stats };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSprintStats(
  sprintId: string,
  startDate: string | null,
  endDate: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<SprintStats> {
  const { data: missions } = await supabase
    .from("missions")
    .select("id, status, updated_at")
    .eq("linked_sprint_id", sprintId);
  const missionRows =
    (missions as { id: string; status: string; updated_at: string }[] | null) ?? [];
  const missionIds = missionRows.map((m) => m.id);
  const activeMissions = missionRows.filter((m) => m.status === "active").length;
  const completedMissions = missionRows.filter((m) => m.status === "completed").length;

  let taskRows: { id: string; status: string; updated_at: string }[] = [];
  if (missionIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, status, updated_at")
      .in("mission_id", missionIds);
    taskRows =
      (tasks as { id: string; status: string; updated_at: string }[] | null) ?? [];
  }
  const completedTasks = taskRows.filter((t) => t.status === "done").length;
  const progressPct = taskRows.length > 0 ? Math.round((completedTasks / taskRows.length) * 100) : null;

  const now = Date.now();
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : null;
  const day = 86_400_000;
  const daysTotal = start != null && end != null ? Math.max(1, Math.round((end - start) / day)) : null;
  const daysElapsed = start != null ? Math.max(0, Math.round((now - start) / day)) : null;
  const daysRemaining = end != null ? Math.round((end - now) / day) : null;
  const expectedProgressPct =
    daysTotal != null && daysElapsed != null
      ? Math.max(0, Math.min(100, Math.round((daysElapsed / daysTotal) * 100)))
      : null;
  const onTrack =
    progressPct != null && expectedProgressPct != null
      ? progressPct >= expectedProgressPct - 15
      : null;

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
    daysTotal,
    daysElapsed,
    daysRemaining,
    expectedProgressPct,
    onTrack,
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
