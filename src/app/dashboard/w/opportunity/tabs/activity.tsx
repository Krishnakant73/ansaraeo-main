import { createClient } from "@/lib/supabase/server";
import { TimelineList, type TimelineListEntry } from "@/workspace/primitives";
import type { Opportunity } from "@/lib/opportunity-workspace";

// ============================================================
// Opportunity › Activity — tasks spawned from this opportunity
// via tasks.source_opportunity_id. Provides a real audit trail of
// what got worked on after "Accept".
// ============================================================

type TaskRow = {
  id: string;
  title: string;
  status: string;
  mission_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export default async function ActivityBody({ opportunity }: { opportunity: Opportunity }) {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, mission_id, created_at, updated_at, completed_at")
    .eq("source_opportunity_id", opportunity.id)
    .order("created_at", { ascending: true });
  const rows = (tasks as TaskRow[] | null) ?? [];

  const events: TimelineListEntry[] = [];
  events.push({
    id: `c-${opportunity.id}`,
    at: opportunity.created_at,
    kind: "mission",
    label: "Opportunity generated",
  });
  for (const t of rows) {
    events.push({
      id: `t-c-${t.id}`,
      at: t.created_at,
      kind: "task",
      label: `Task created · ${t.title}`,
    });
    if (t.completed_at) {
      events.push({
        id: `t-d-${t.id}`,
        at: t.completed_at,
        kind: "task",
        label: `Task done · ${t.title}`,
      });
    }
  }
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Activity</h2>
        <p className="mt-1 text-sm text-muted">
          What happened after this opportunity got accepted. Sourced from
          tasks.source_opportunity_id.
        </p>
      </div>
      <TimelineList
        entries={events}
        emptyState={
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
            <p className="text-sm text-ink">Not accepted yet.</p>
            <p className="mt-1 text-xs text-muted">
              Accepting this opportunity creates a mission with a fix → verify task sequence.
            </p>
          </div>
        }
      />
    </div>
  );
}
