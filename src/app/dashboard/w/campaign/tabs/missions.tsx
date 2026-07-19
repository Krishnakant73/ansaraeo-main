import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import { Target } from "lucide-react";
import { timeAgo, type Campaign } from "@/lib/campaign-workspace";

// ============================================================
// Campaign › Missions — the objective container list. Each row
// shows status, priority, owner-in-name-only (id, we don't join
// auth.users for simplicity), and task counts.
// ============================================================

type Row = {
  id: string;
  title: string;
  objective: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  updated_at: string;
  taskCount: number;
  doneCount: number;
};

export default async function MissionsBody({ campaign }: { campaign: Campaign }) {
  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, objective, status, priority, due_date, updated_at")
    .eq("linked_campaign_id", campaign.id)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(100);
  const missionRows = (missions as Omit<Row, "taskCount" | "doneCount">[] | null) ?? [];

  // One task query for all missions in this campaign.
  const missionIds = missionRows.map((m) => m.id);
  const taskCountByMission = new Map<string, { total: number; done: number }>();
  if (missionIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("mission_id, status")
      .in("mission_id", missionIds);
    for (const t of (tasks as { mission_id: string; status: string }[] | null) ?? []) {
      const cur = taskCountByMission.get(t.mission_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      taskCountByMission.set(t.mission_id, cur);
    }
  }

  const rows: Row[] = missionRows.map((m) => ({
    ...m,
    taskCount: taskCountByMission.get(m.id)?.total ?? 0,
    doneCount: taskCountByMission.get(m.id)?.done ?? 0,
  }));

  const now = Date.now();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Missions</h2>
        <p className="mt-1 text-sm text-muted">
          Every mission linked to this campaign, prioritized. Each mission rolls up its own tasks.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyStateCoach
          variant="coach"
          icon={Target}
          title="No missions yet"
          description="Missions are the objective containers under this campaign. The fastest way to add one is to accept an opportunity — the queue picks the highest-priority fix and creates a mission for you."
          action={{
            label: "Open opportunities",
            href: `/dashboard/w/brand/${campaign.brand.slug}/recommendations`,
          }}
          secondary={{
            label: "Create manually",
            href: `/dashboard/b/${campaign.brand.slug}/campaigns`,
          }}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => {
            const overdue = m.status !== "completed" && m.due_date && new Date(m.due_date).getTime() < now;
            const progress = m.taskCount > 0 ? Math.round((m.doneCount / m.taskCount) * 100) : null;
            return (
              <li key={m.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/w/mission/${m.id}/overview`}
                      className="block truncate text-sm font-semibold text-ink hover:text-accent"
                    >
                      {m.title}
                    </Link>
                    {m.objective && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{m.objective}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="chip">P{m.priority}</span>
                      <span
                        className={
                          m.status === "completed"
                            ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                            : m.status === "on_hold"
                              ? "chip border-amber-200 bg-amber-50 text-amber-700"
                              : "chip"
                        }
                      >
                        {m.status.replace(/_/g, " ")}
                      </span>
                      {overdue && (
                        <span className="chip border-rose-200 bg-rose-50 text-rose-600">overdue</span>
                      )}
                      <span className="chip">
                        {m.doneCount}/{m.taskCount} task{m.taskCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted">
                    {timeAgo(m.updated_at)}
                  </div>
                </div>
                {progress != null && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
