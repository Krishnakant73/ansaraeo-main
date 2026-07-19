import Link from "next/link";
import InsightCard from "@/workspace/primitives/InsightCard";
import { timeAgo, typeLabel, type Task } from "@/lib/task-workspace";

// ============================================================
// Task › Overview — surfaces the "what" (title + type), the "why"
// (source link), the "where" (engine_action target), and the
// verification story (if it's a verify task, the pass/fail bit).
// ============================================================

export default function OverviewBody({ task }: { task: Task }) {
  const engine = (task.engine_action as { engine?: string; route?: string })?.engine;
  const route = (task.engine_action as { engine?: string; route?: string })?.route;
  const overdue = task.stats.isOverdue;

  return (
    <div className="space-y-6">
      {/* Title + type */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Task</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{task.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="chip">{typeLabel(task.type)}</span>
              <span className="chip">{task.status.replace(/_/g, " ")}</span>
              {task.assignee_id && <span className="chip">assigned</span>}
              {!task.assignee_id && <span className="chip">unassigned</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Age</p>
            <p className="text-2xl font-bold tracking-tight text-ink">{task.stats.ageInDays}d</p>
            <p className="text-[11px] text-muted">since created</p>
          </div>
        </div>
      </section>

      {overdue && (
        <InsightCard
          variant="warning"
          title="Task is past its due date"
          description={`Due ${new Date(task.due_date!).toLocaleDateString()} — bump the date or unblock it.`}
        />
      )}
      {task.stats.pendingApprovals > 0 && (
        <InsightCard
          variant="opportunity"
          title={`${task.stats.pendingApprovals} approval${task.stats.pendingApprovals === 1 ? "" : "s"} pending`}
          description="Waiting on sign-off before this task can move to done."
        />
      )}
      {task.status === "blocked" && (
        <InsightCard
          variant="warning"
          title="Blocked"
          description="This task cannot progress until its blocker is cleared. Note what's blocking it in the mission notes."
        />
      )}
      {task.type === "verify" && task.stats.hasVerification && task.stats.verificationPassed === false && (
        <InsightCard
          variant="warning"
          title="Verification failed"
          description="The verify task ran but the diff against the pre-fix baseline didn't pass. Inspect verification_result."
        />
      )}
      {task.type === "verify" && task.stats.hasVerification && task.stats.verificationPassed === true && (
        <InsightCard
          variant="win"
          title="Verification passed"
          description="The verify task confirmed the fix — this mission's work loop is closed."
        />
      )}

      {/* Engine target */}
      {(engine || route) && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Engine target</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink">
            {engine && <span className="chip">{engine.replace(/_/g, " ")}</span>}
            {route && <code className="rounded bg-surface px-1.5 py-0.5 text-xs">{route}</code>}
          </div>
          <p className="mt-2 text-xs text-muted">
            The route the deploy/verify sub-task will hit when it runs.
          </p>
        </section>
      )}

      {/* Context strip */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title={`Mission · ${task.mission.title}`}
          description={`P${task.mission.priority} · ${task.mission.status.replace(/_/g, " ")}. Open the parent mission.`}
          href={`/dashboard/w/mission/${task.mission.id}/tasks`}
          meta="Mission"
        />
        <InsightCard
          variant="info"
          title={`Brand · ${task.brand.name}`}
          description="Open the brand workspace for the operational picture."
          href={`/dashboard/w/brand/${task.brand.slug}/overview`}
          meta="Brand"
        />
      </div>

      {/* Provenance */}
      {(task.source_opportunity_id || task.source_automation_id) && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Provenance</h3>
          <ul className="space-y-2 text-sm">
            {task.source_opportunity_id && (
              <li className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-3">
                <span className="text-muted">Created from opportunity</span>
                <Link
                  href={`/dashboard/w/opportunity/${task.source_opportunity_id}/overview`}
                  className="text-accent hover:underline"
                >
                  Open →
                </Link>
              </li>
            )}
            {task.source_automation_id && (
              <li className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-3">
                <span className="text-muted">Created by automation</span>
                <Link
                  href={`/dashboard/w/automation/${task.source_automation_id}/overview`}
                  className="text-accent hover:underline"
                >
                  Open →
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">
        Updated {timeAgo(task.updated_at)}
        {task.completed_at && ` · completed ${timeAgo(task.completed_at)}`}
      </p>
    </div>
  );
}
