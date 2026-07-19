import { TimelineList, type TimelineListEntry } from "@/workspace/primitives";
import type { ContentItem } from "@/lib/content-workspace";

// ============================================================
// Content › Activity — a compressed timeline: created, approved,
// (optionally) published. content_items doesn't have per-field
// audit history, so this stays honest and small.
// ============================================================

export default function ActivityBody({ item }: { item: ContentItem }) {
  const rows: TimelineListEntry[] = [];
  rows.push({
    id: `c-${item.id}`,
    at: item.created_at,
    kind: "content",
    label: "Draft created",
  });
  if (item.approved_at) {
    rows.push({
      id: `a-${item.id}`,
      at: item.approved_at,
      kind: "approval",
      label: item.status === "published" ? "Approved (later published)" : "Approved",
      detail: item.approved_by ? `by ${item.approved_by.slice(0, 8)}` : undefined,
    });
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Activity</h2>
        <p className="mt-1 text-sm text-muted">
          Content item milestones. Field-level history isn&rsquo;t recorded — the source of truth
          is the current state on this row.
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
