import Link from "next/link";
import { timeAgo, type Task } from "@/lib/task-workspace";

// ============================================================
// Task › Approvals — sign-off status specific to THIS task. A single
// task may have multiple approvers (e.g. content lead + admin);
// pending ones gate deploy.
// ============================================================

export default function ApprovalsBody({ task }: { task: Task }) {
  const pending = task.approvals.filter((a) => a.status === "pending");
  const resolved = task.approvals.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Approvals</h2>
        <p className="mt-1 text-sm text-muted">
          Role-gated sign-offs required before this task can deploy. Approve on the{" "}
          <Link href={`/dashboard/b/${task.brand.slug}/approvals`} className="text-accent hover:underline">
            Approvals page
          </Link>
          .
        </p>
      </div>

      {task.approvals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No approvals for this task.</p>
          <p className="mt-1 text-xs text-muted">
            {task.type === "deploy"
              ? "A deploy task without approvals will still deploy — configure required approvers to add a gate."
              : "Only deploy-type tasks usually need approvals."}
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
              <p className="section-label text-amber-700">Pending ({pending.length})</p>
              <ul className="mt-2 space-y-2">
                {pending.map((a) => (
                  <li key={a.id} className="rounded-xl border border-line bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          Requires <span className="font-semibold">{a.approver_role}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          Requested {timeAgo(a.created_at)}
                        </p>
                        {a.note && <p className="mt-1 text-xs text-muted">Note: {a.note}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {resolved.length > 0 && (
            <section className="rounded-2xl border border-line bg-white p-4">
              <p className="section-label">Resolved ({resolved.length})</p>
              <ul className="mt-2 space-y-2">
                {resolved.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{a.approver_role}</p>
                      {a.note && <p className="mt-0.5 text-xs text-muted">Note: {a.note}</p>}
                      <p className="mt-0.5 text-[11px] text-muted">
                        Decided {timeAgo(a.decided_at)}
                      </p>
                    </div>
                    <span
                      className={
                        a.status === "approved"
                          ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "chip border-rose-200 bg-rose-50 text-rose-600"
                      }
                    >
                      {a.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
