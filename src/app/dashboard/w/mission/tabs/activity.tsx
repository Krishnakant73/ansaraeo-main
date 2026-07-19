import { createClient } from "@/lib/supabase/server";
import { TimelineList, type TimelineListEntry } from "@/workspace/primitives";
import type { Mission } from "@/lib/mission-workspace";

// ============================================================
// Mission › Activity — chronological rail: task creations,
// completions, status transitions, approval decisions. Data
// gathered here; visual rail rendered by the shared TimelineList.
// ============================================================

export default async function ActivityBody({ mission }: { mission: Mission }) {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, type, status, created_at, updated_at, completed_at")
    .eq("mission_id", mission.id);
  const taskRows =
    (tasks as {
      id: string;
      title: string;
      type: string;
      status: string;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }[] | null) ?? [];

  const taskIds = taskRows.map((t) => t.id);
  let approvalRows: {
    id: string;
    status: string;
    created_at: string;
    decided_at: string | null;
    task_id: string;
  }[] = [];
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("approvals")
      .select("id, status, created_at, decided_at, task_id")
      .in("task_id", taskIds);
    approvalRows =
      (data as {
        id: string;
        status: string;
        created_at: string;
        decided_at: string | null;
        task_id: string;
      }[] | null) ?? [];
  }
  const taskTitle = new Map(taskRows.map((t) => [t.id, t.title]));

  const rows: TimelineListEntry[] = [];
  rows.push({
    id: `m-${mission.id}`,
    at: mission.created_at,
    kind: "mission",
    label: `Mission created · ${mission.title}`,
  });
  for (const t of taskRows) {
    rows.push({
      id: `t-c-${t.id}`,
      at: t.created_at,
      kind: "task",
      label: `Task created · ${t.title}`,
    });
    if (t.completed_at) {
      rows.push({
        id: `t-d-${t.id}`,
        at: t.completed_at,
        kind: "task",
        label: `Task done · ${t.title}`,
      });
    }
  }
  for (const a of approvalRows) {
    const title = taskTitle.get(a.task_id) ?? "task";
    rows.push({
      id: `a-c-${a.id}`,
      at: a.created_at,
      kind: "approval",
      label: `Approval requested · ${title}`,
    });
    if (a.decided_at) {
      rows.push({
        id: `a-d-${a.id}`,
        at: a.decided_at,
        kind: "approval",
        label: `Approval ${a.status} · ${title}`,
      });
    }
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Activity</h2>
        <p className="mt-1 text-sm text-muted">
          Everything that happened on {mission.title}, newest first.
        </p>
      </div>
      <TimelineList
        entries={rows}
        emptyState={
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
            <p className="text-sm text-ink">No activity recorded.</p>
          </div>
        }
      />
    </div>
  );
}
