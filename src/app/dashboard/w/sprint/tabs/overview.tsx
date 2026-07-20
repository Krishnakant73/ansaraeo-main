import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InsightCard from "@/workspace/primitives/InsightCard";
import type { Sprint } from "@/lib/sprint-workspace";

// ============================================================
// Sprint › Overview — goal, time window, on-track health, and
// the missions this sprint is currently pushing.
// ============================================================

type MissionRow = {
  id: string;
  title: string;
  status: string;
  priority: number;
  due_date: string | null;
};

export default async function OverviewBody({ sprint }: { sprint: Sprint }) {
  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, status, priority, due_date")
    .eq("linked_sprint_id", sprint.id)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(5);
  const topMissions = (missions as MissionRow[] | null) ?? [];

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const overRun = sprint.stats.daysRemaining != null && sprint.stats.daysRemaining < 0 && sprint.status !== "completed";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Goal</p>
            <p className="mt-1 text-base leading-relaxed text-ink">
              {sprint.goal ?? (
                <span className="italic text-muted">
                  No goal set — sprints hit harder with a one-line goal.
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              {sprint.start_date && (
                <span className="chip">
                  {new Date(sprint.start_date).toLocaleDateString()} →{" "}
                  {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : "open-ended"}
                </span>
              )}
              {sprint.stats.daysTotal != null && (
                <span className="chip">{sprint.stats.daysTotal}d total</span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Progress</p>
            <p className="text-2xl font-bold tracking-tight text-ink">
              {sprint.stats.progressPct == null ? "—" : `${sprint.stats.progressPct}%`}
            </p>
            <p className="text-[11px] text-muted">
              {sprint.stats.completedTasks} / {sprint.stats.taskCount} tasks
            </p>
          </div>
        </div>

        {sprint.stats.progressPct != null && sprint.stats.expectedProgressPct != null && (
          <div className="mt-4">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${sprint.stats.progressPct}%` }}
              />
              <div
                className="absolute top-0 h-full w-px bg-ink/40"
                style={{ left: `${sprint.stats.expectedProgressPct}%` }}
                title={`Expected ${sprint.stats.expectedProgressPct}%`}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
              <span>
                Actual <span className="font-semibold text-ink">{sprint.stats.progressPct}%</span>
              </span>
              <span>
                Expected{" "}
                <span className="font-semibold text-ink">{sprint.stats.expectedProgressPct}%</span>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Health cards */}
      {sprint.stats.onTrack === false && (
        <InsightCard
          variant="warning"
          title="Sprint is behind pace"
          description={`Task completion is ${sprint.stats.progressPct}%, but ${sprint.stats.expectedProgressPct}% of the window has elapsed. Prioritize unblocking, or adjust scope.`}
        />
      )}
      {sprint.stats.onTrack === true && sprint.stats.progressPct !== 100 && (
        <InsightCard
          variant="win"
          title="On pace"
          description={`Progress is at or above the linear expectation for elapsed time. Keep the cadence.`}
        />
      )}
      {overRun && (
        <InsightCard
          variant="warning"
          title="Sprint ran over its end date"
          description={`Ended ${Math.abs(sprint.stats.daysRemaining!)}d ago. Move unfinished work to the next sprint or close this one.`}
        />
      )}
      {sprint.status === "completed" && sprint.stats.progressPct !== 100 && (
        <InsightCard
          variant="info"
          title="Closed with unfinished work"
          description={`${sprint.stats.taskCount - sprint.stats.completedTasks} task(s) didn't ship. Roll them into the next sprint.`}
        />
      )}

      {/* Top missions */}
      {topMissions.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">In this sprint</h2>
            <Link
              href={`/dashboard/w/sprint/${sprint.id}/missions`}
              className="text-xs font-medium text-accent hover:underline"
            >
              View all →
            </Link>
          </div>
          <ul className="space-y-2">
            {topMissions.map((m) => {
              const overdue =
                m.status !== "completed" && m.due_date && new Date(m.due_date).getTime() < now;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/w/mission/${m.id}/overview`}
                      className="block truncate text-sm font-medium text-ink hover:text-accent"
                    >
                      {m.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                        <span className="chip border-rose-200 bg-rose-50 text-rose-600">
                          overdue
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {topMissions.length === 0 && (
        <InsightCard
          variant="info"
          title="No missions yet"
          description={`Assign missions to this sprint by setting their linked_sprint_id, or accept an opportunity for ${sprint.brand.name} into this sprint.`}
          href={`/dashboard/w/brand/${sprint.brand.slug}/recommendations`}
        />
      )}
    </div>
  );
}
