import { createClient } from "@/lib/supabase/server";
import { TimelineList, type TimelineListEntry } from "@/workspace/primitives";
import type { Sprint } from "@/lib/sprint-workspace";

// ============================================================
// Sprint › Activity — chronological log spanning all missions in
// the sprint: mission create/complete, task done, task state
// transitions (approx via updated_at).
// ============================================================

export default async function ActivityBody({ sprint }: { sprint: Sprint }) {
  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, status, created_at, updated_at")
    .eq("linked_sprint_id", sprint.id);
  const missionRows =
    (missions as { id: string; title: string; status: string; created_at: string; updated_at: string }[] | null) ??
    [];
  const missionIds = missionRows.map((m) => m.id);
  const missionTitle = new Map(missionRows.map((m) => [m.id, m.title]));

  let taskRows: {
    id: string;
    title: string;
    status: string;
    mission_id: string;
    updated_at: string;
    completed_at: string | null;
    created_at: string;
  }[] = [];
  if (missionIds.length > 0) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, mission_id, updated_at, completed_at, created_at")
      .in("mission_id", missionIds)
      .order("updated_at", { ascending: false })
      .limit(200);
    taskRows =
      (data as typeof taskRows | null) ?? [];
  }

  const rows: TimelineListEntry[] = [];
  rows.push({
    id: `s-${sprint.id}`,
    at: sprint.created_at,
    kind: "sprint",
    label: `Sprint created · ${sprint.name}`,
  });
  for (const m of missionRows) {
    rows.push({
      id: `m-c-${m.id}`,
      at: m.created_at,
      kind: "mission",
      label: "Mission scheduled",
      detail: m.title,
    });
    if (m.status === "completed" && m.updated_at !== m.created_at) {
      rows.push({
        id: `m-d-${m.id}`,
        at: m.updated_at,
        kind: "mission",
        label: "Mission completed",
        detail: m.title,
      });
    }
  }
  for (const t of taskRows) {
    if (t.completed_at) {
      rows.push({
        id: `t-d-${t.id}`,
        at: t.completed_at,
        kind: "task",
        label: `Task done · ${t.title}`,
        detail: missionTitle.get(t.mission_id) ?? "",
      });
    }
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Activity</h2>
        <p className="mt-1 text-sm text-muted">
          Everything that happened inside {sprint.name}, newest first.
        </p>
      </div>
      <TimelineList
        entries={rows}
        emptyState={
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
            <p className="text-sm text-ink">No activity yet.</p>
            <p className="mt-1 text-xs text-muted">Assign missions to fill the timeline.</p>
          </div>
        }
      />
    </div>
  );
}
