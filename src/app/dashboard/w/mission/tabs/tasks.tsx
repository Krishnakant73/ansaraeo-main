import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import { LayoutGrid } from "lucide-react";
import { timeAgo, type Mission } from "@/lib/mission-workspace";

// ============================================================
// Mission › Tasks — the actual work queue. Rendered as a kanban
// (same 5 columns as Campaign › Tasks) but scoped to a single
// mission. Task rows show type + due date + last-updated.
// ============================================================

type Row = {
  id: string;
  title: string;
  type: string;
  status: string;
  due_date: string | null;
  updated_at: string;
};

const COLUMNS: { key: string; label: string; tone: string }[] = [
  { key: "todo", label: "To do", tone: "border-line bg-surface" },
  { key: "in_progress", label: "In progress", tone: "border-accent/30 bg-accent/5" },
  { key: "in_review", label: "In review", tone: "border-amber-200 bg-amber-50/40" },
  { key: "blocked", label: "Blocked", tone: "border-rose-200 bg-rose-50/40" },
  { key: "done", label: "Done", tone: "border-emerald-200 bg-emerald-50/40" },
];

export default async function TasksBody({ mission }: { mission: Mission }) {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, type, status, due_date, updated_at")
    .eq("mission_id", mission.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  const rows = (tasks as Row[] | null) ?? [];
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const byStatus = new Map<string, Row[]>();
  for (const t of rows) {
    const bucket = t.status === "backlog" ? "todo" : t.status;
    const arr = byStatus.get(bucket) ?? [];
    arr.push(t);
    byStatus.set(bucket, arr);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Tasks</h2>
        <p className="mt-1 text-sm text-muted">
          Every task on {mission.title}. Tasks step through the fix → verify sequence.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyStateCoach
          variant="coach"
          icon={LayoutGrid}
          title="No tasks yet"
          description="Tasks get created when the mission is decomposed — usually from accepting an opportunity. Open the queue to accept one and generate the fix → verify sequence automatically."
          action={{
            label: "Open opportunities",
            href: `/dashboard/w/brand/${mission.brand.slug}/recommendations`,
          }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {COLUMNS.map((col) => {
            const list = byStatus.get(col.key) ?? [];
            return (
              <div
                key={col.key}
                className={`flex flex-col gap-2 rounded-2xl border ${col.tone} p-3 min-h-[200px]`}
              >
                <div className="flex items-center justify-between">
                  <p className="section-label">{col.label}</p>
                  <span className="text-xs text-muted">{list.length}</span>
                </div>
                <ul className="space-y-2">
                  {list.slice(0, 25).map((t) => {
                    const overdue =
                      t.status !== "done" &&
                      t.status !== "cancelled" &&
                      t.due_date &&
                      new Date(t.due_date).getTime() < now;
                    return (
                      <li key={t.id} className="rounded-xl border border-line bg-white p-2.5">
                        <p className="line-clamp-2 text-xs font-medium text-ink">{t.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="chip text-[10px]">{t.type}</span>
                          {overdue && (
                            <span className="chip border-rose-200 bg-rose-50 text-rose-600 text-[10px]">
                              overdue
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-muted">{timeAgo(t.updated_at)}</p>
                      </li>
                    );
                  })}
                  {list.length > 25 && (
                    <li className="text-[10px] text-muted">…and {list.length - 25} more</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
