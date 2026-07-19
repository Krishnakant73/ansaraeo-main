import { createClient } from "@/lib/supabase/server";
import TimelineList, { type TimelineListEntry } from "@/workspace/primitives/TimelineList";
import { EmptyStateCoach } from "@/workspace/primitives";
import { detectEngineChanges, type EngineChangeEvent } from "@/lib/engine-change-log";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// AiChangeLog — the Model Changes tab body. Deterministic drift
// detection (baseline_drift, citation_shift) merged with any
// engine_change_events rows (kind='manual' or 'format_shift').
//
// The TimelineList primitive renders it with kind-tinted dots.
// ============================================================

const KIND_TONE: Record<EngineChangeEvent["kind"], string> = {
  baseline_drift: "scan",
  citation_shift: "content",
  format_shift: "campaign",
  manual: "alert",
};

export default async function AiChangeLog({ engine }: { engine: Engine }) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = await detectEngineChanges(supabase as any, engine.id, engine.brand.id);

  if (events.length === 0) {
    return (
      <EmptyStateCoach
        title="No change events yet"
        description="Engine snapshots build up over days. As soon as behavior drifts by 8pp week-over-week, an entry appears here."
        action={{
          label: "See how snapshots work",
          href: `/dashboard/w/engine/${engine.name}/behavior`,
        }}
      />
    );
  }

  const entries: TimelineListEntry[] = events.map((e, i) => ({
    id: `${e.kind}-${e.at}-${i}`,
    at: e.at,
    kind: KIND_TONE[e.kind] ?? "scan",
    label:
      e.kind === "baseline_drift"
        ? `Mention rate ${e.magnitude != null && e.magnitude > 0 ? "up" : "down"} ${Math.abs(e.magnitude ?? 0)}pp`
        : e.kind === "citation_shift"
          ? `Citation share ${e.magnitude != null && e.magnitude > 0 ? "up" : "down"} ${Math.abs(e.magnitude ?? 0)}pp`
          : e.kind === "format_shift"
            ? `Format bias shift ${e.magnitude != null && e.magnitude > 0 ? "+" : ""}${e.magnitude ?? 0}`
            : e.summary,
    detail: e.summary,
  }));

  return (
    <section aria-label={`Change log for ${engine.displayName}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="section-label">AI Change Log</p>
        <span className="text-[11px] text-muted">
          Detected + recorded shifts, newest first
        </span>
      </div>
      <TimelineList entries={entries} />
    </section>
  );
}
