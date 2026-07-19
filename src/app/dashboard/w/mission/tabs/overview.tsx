import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InsightCard from "@/workspace/primitives/InsightCard";
import type { Mission } from "@/lib/mission-workspace";

// ============================================================
// Mission › Overview — objective, progress, next task to work on,
// and the "verify" step (final sub-task of every decomposition).
// Answers "what should I be doing on this mission right now?"
// ============================================================

type TaskRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  due_date: string | null;
  updated_at: string;
};

export default async function OverviewBody({ mission }: { mission: Mission }) {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, type, status, due_date, updated_at")
    .eq("mission_id", mission.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  const rows = (tasks as TaskRow[] | null) ?? [];

  // "Next task" = first non-done task, prioritising in_progress > todo > backlog.
  const rank: Record<string, number> = { in_progress: 0, in_review: 1, todo: 2, backlog: 3, blocked: 4 };
  const active = rows
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5));
  const next = active[0] ?? null;
  const verify = rows.find((t) => t.type === "verify");

  const now = Date.now();
  const overdue = mission.due_date && new Date(mission.due_date).getTime() < now && mission.status !== "completed";

  return (
    <div className="space-y-6">
      {/* Objective + progress */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Objective</p>
            <p className="mt-1 text-base leading-relaxed text-ink">
              {mission.objective ?? (
                <span className="italic text-muted">
                  No objective set — {mission.title} runs on the title alone.
                </span>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Progress</p>
            <p className="text-2xl font-bold tracking-tight text-ink">
              {mission.stats.progressPct == null ? "—" : `${mission.stats.progressPct}%`}
            </p>
            <p className="text-[11px] text-muted">
              {mission.stats.completedTasks} / {mission.stats.taskCount} tasks
            </p>
          </div>
        </div>
        {mission.stats.progressPct != null && (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${mission.stats.progressPct}%` }}
            />
          </div>
        )}
      </section>

      {overdue && (
        <InsightCard
          variant="warning"
          title="Mission is past its due date"
          description={`Due ${new Date(mission.due_date!).toLocaleDateString()} — reassess or extend.`}
        />
      )}
      {mission.stats.blockedTasks > 0 && (
        <InsightCard
          variant="warning"
          title={`${mission.stats.blockedTasks} blocked task${mission.stats.blockedTasks === 1 ? "" : "s"}`}
          description="Unblock or reassign — blocked tasks can silently stall a mission."
          href={`/dashboard/w/mission/${mission.id}/tasks`}
        />
      )}
      {mission.stats.pendingApprovals > 0 && (
        <InsightCard
          variant="opportunity"
          title={`${mission.stats.pendingApprovals} approval${mission.stats.pendingApprovals === 1 ? "" : "s"} pending`}
          description="Sign off to unblock deploy and verify."
          href={`/dashboard/w/mission/${mission.id}/approvals`}
        />
      )}
      {mission.stats.progressPct === 100 && mission.status !== "completed" && (
        <InsightCard
          variant="win"
          title="Every task in this mission is done"
          description="Mark the mission complete — its work loop is finished."
        />
      )}

      {/* Next task */}
      {next && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Do next</h2>
          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{next.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="chip">{next.type}</span>
                  <span className="chip">{next.status.replace(/_/g, " ")}</span>
                </div>
              </div>
              <Link
                href={`/dashboard/w/mission/${mission.id}/tasks`}
                className="btn-sm shrink-0"
              >
                Open
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Verify step */}
      {verify && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Verify step</p>
          <p className="mt-1 text-sm text-ink">{verify.title}</p>
          <p className="mt-1 text-xs text-muted">
            The mission is not complete until this task passes.{" "}
            <span className="chip">{verify.status.replace(/_/g, " ")}</span>
          </p>
        </section>
      )}

      {/* Context strip */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title={`Brand · ${mission.brand.name}`}
          description="Open the brand workspace for the full picture."
          href={`/dashboard/w/brand/${mission.brand.slug}/overview`}
          meta="Brand"
        />
        {mission.campaign && (
          <InsightCard
            variant="info"
            title={`Campaign · ${mission.campaign.name}`}
            description="Jump to the parent campaign to see sibling missions."
            href={`/dashboard/w/campaign/${mission.campaign.id}/overview`}
            meta="Campaign"
          />
        )}
      </div>
    </div>
  );
}
