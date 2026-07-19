import { createClient } from "@/lib/supabase/server";
import { timeAgo, type Campaign } from "@/lib/campaign-workspace";

// ============================================================
// Campaign › Tasks — a kanban-lite view across every mission's
// tasks. Grouped by status (todo/in_progress/in_review/blocked/done).
// Each column caps at 20 rows for a fast first paint.
// ============================================================

type Row = {
  id: string;
  mission_id: string;
  title: string;
  type: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  updated_at: string;
};

const COLUMNS: { key: string; label: string; tone: string }[] = [
  { key: "todo", label: "To do", tone: "border-line bg-surface" },
  { key: "in_progress", label: "In progress", tone: "border-accent/30 bg-accent/5" },
  { key: "in_review", label: "In review", tone: "border-amber-200 bg-amber-50/40" },
  { key: "blocked", label: "Blocked", tone: "border-rose-200 bg-rose-50/40" },
  { key: "done", label: "Done", tone: "border-emerald-200 bg-emerald-50/40" },
];

export default async function TasksBody({ campaign }: { campaign: Campaign }) {
  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title")
    .eq("linked_campaign_id", campaign.id);
  const missionMap = new Map<string, string>();
  for (const m of (missions as { id: string; title: string }[] | null) ?? []) {
    missionMap.set(m.id, m.title);
  }
  const missionIds = Array.from(missionMap.keys());
  let rows: Row[] = [];
  if (missionIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, mission_id, title, type, status, due_date, completed_at, updated_at")
      .in("mission_id", missionIds)
      .order("updated_at", { ascending: false })
      .limit(500);
    rows = (tasks as Row[] | null) ?? [];
  }

  const now = Date.now();
  const byStatus = new Map<string, Row[]>();
  for (const t of rows) {
    // Fold backlog+todo together (avoid an empty column when everything's in backlog).
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
          Every task rolling up under this campaign&rsquo;s missions.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No tasks yet.</p>
          <p className="mt-1 text-xs text-muted">Tasks appear here as missions get decomposed.</p>
        </div>
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
                  {list.slice(0, 20).map((t) => {
                    const overdue =
                      t.status !== "done" &&
                      t.status !== "cancelled" &&
                      t.due_date &&
                      new Date(t.due_date).getTime() < now;
                    return (
                      <li
                        key={t.id}
                        className="rounded-xl border border-line bg-white p-2.5"
                      >
                        <p className="line-clamp-2 text-xs font-medium text-ink">{t.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="chip text-[10px]">{t.type}</span>
                          {overdue && (
                            <span className="chip border-rose-200 bg-rose-50 text-rose-600 text-[10px]">
                              overdue
                            </span>
                          )}
                          {missionMap.get(t.mission_id) && (
                            <span
                              className="truncate text-[10px] text-muted"
                              title={missionMap.get(t.mission_id)}
                            >
                              {(missionMap.get(t.mission_id) ?? "").slice(0, 20)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-muted">{timeAgo(t.updated_at)}</p>
                      </li>
                    );
                  })}
                  {list.length > 20 && (
                    <li className="text-[10px] text-muted">…and {list.length - 20} more</li>
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
