import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Recommendations — engine-scoped opportunity board.
//
// Renders every opportunity_recommendations row whose engine_id
// matches the current engine. The Optimization Strategy Generator
// on the Optimization tab is what usually creates these rows.
//
// Each card shows priority, impact, kind, and status; clicking
// jumps to the Battle Plan for status updates.
// ============================================================

type Row = {
  id: string;
  title: string;
  detail: Record<string, unknown> | null;
  estimated_impact: Record<string, unknown> | null;
  priority_score: number | null;
  status: string | null;
  created_at: string | null;
};

const STATUS_TONE: Record<string, string> = {
  open: "border-accent/30 bg-accent/5 text-accent",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  snoozed: "border-line bg-surface text-muted",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  dismissed: "border-line bg-white text-muted",
};

export default async function RecommendationsBody({ engine }: { engine: Engine }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunity_recommendations")
    .select("id, title, detail, estimated_impact, priority_score, status, created_at")
    .eq("brand_id", engine.brand.id)
    .eq("engine_id", engine.id)
    .order("priority_score", { ascending: false, nullsFirst: false })
    .limit(30);
  const rows = (data as Row[] | null) ?? [];

  if (rows.length === 0) {
    return (
      <EmptyStateCoach
        title="No engine-specific opportunities yet"
        description={`Generate a set of moves tuned to how ${engine.displayName} answers.`}
        action={{
          label: "Open Optimization",
          href: `/dashboard/w/engine/${engine.name}/optimization`,
        }}
      />
    );
  }

  return (
    <section aria-label={`Opportunities for ${engine.displayName}`}>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Engine-specific opportunities</h2>
          <p className="mt-1 text-sm text-muted">
            Moves scoped to {engine.displayName} for {engine.brand.name}. Priority ordered.
          </p>
        </div>
        <Link
          href={`/dashboard/w/engine/${engine.name}/optimization`}
          className="btn-sm inline-flex items-center gap-2 self-start md:self-auto"
        >
          Generate more
        </Link>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const kind = (r.detail as { kind?: string } | null)?.kind ?? null;
          const rationale = (r.detail as { rationale?: string } | null)?.rationale ?? null;
          const impact = r.estimated_impact as
            | { mentions_per_month?: number; visibility_delta?: number }
            | null;
          const status = (r.status ?? "open").toLowerCase();
          return (
            <li key={r.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {kind && <p className="text-[11px] font-mono text-muted">{kind}</p>}
                  <p className="mt-0.5 text-sm font-semibold text-ink">{r.title}</p>
                </div>
                <span
                  className={`chip shrink-0 ${STATUS_TONE[status] ?? STATUS_TONE.open}`}
                >
                  {status.replace("_", " ")}
                </span>
              </div>
              {rationale && (
                <p className="mt-2 text-xs text-ink/80">{rationale}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {r.priority_score != null && (
                  <span className="chip">Priority {Math.round(Number(r.priority_score))}</span>
                )}
                {impact?.mentions_per_month != null && (
                  <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                    +{impact.mentions_per_month} mentions/mo
                  </span>
                )}
                {impact?.visibility_delta != null && (
                  <span className="chip">+{impact.visibility_delta}pp visibility</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
