import { createClient } from "@/lib/supabase/server";
import { timeAgo, type Mission } from "@/lib/mission-workspace";

// ============================================================
// Mission › Approvals — pending + resolved sign-offs on this
// mission's tasks. Approvers are org-role gated; this tab just
// surfaces status, no in-UI approve action yet (owned by /approvals).
// ============================================================

type Row = {
  id: string;
  status: string;
  approver_role: string;
  note: string | null;
  created_at: string;
  decided_at: string | null;
  task_id: string | null;
  task_title: string | null;
};

export default async function ApprovalsBody({ mission }: { mission: Mission }) {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("mission_id", mission.id);
  const taskTitles = new Map(
    ((tasks as { id: string; title: string }[] | null) ?? []).map((t) => [t.id, t.title]),
  );
  const taskIds = Array.from(taskTitles.keys());

  let approvals: Row[] = [];
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("approvals")
      .select("id, status, approver_role, note, created_at, decided_at, task_id")
      .in("task_id", taskIds)
      .order("created_at", { ascending: false })
      .limit(50);
    approvals = ((data as Omit<Row, "task_title">[] | null) ?? []).map((a) => ({
      ...a,
      task_title: a.task_id ? taskTitles.get(a.task_id) ?? null : null,
    }));
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Approvals</h2>
        <p className="mt-1 text-sm text-muted">
          Role-gated sign-offs required before deploy. Approve on the{" "}
          <a
            href={`/dashboard/b/${mission.brand.slug}/approvals`}
            className="text-accent hover:underline"
          >
            Approvals page
          </a>
          .
        </p>
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No approvals for this mission.</p>
          <p className="mt-1 text-xs text-muted">
            Deploy-type tasks generate approvals when they enter review.
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
              <p className="section-label text-amber-700">
                Pending ({pending.length})
              </p>
              <ul className="mt-2 space-y-2">
                {pending.map((a) => (
                  <li key={a.id} className="rounded-xl border border-line bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {a.task_title ?? "Approval"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          Requires <span className="font-semibold">{a.approver_role}</span> · requested{" "}
                          {timeAgo(a.created_at)}
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
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-ink">
                      {a.task_title ?? "Approval"}
                    </span>
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
