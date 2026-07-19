import Link from "next/link";
import { Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// OpportunityRadar — a horizontal band that always sits at the top
// of the Battle Plan tab (and drawer). Shows up to 6 high-signal
// opportunities surfaced in the last 24h. Each slot is Accept /
// Snooze / Reject in place — the actions delegate to the existing
// opportunity_dismissals + missions/tasks pipelines.
//
// Motion: [data-motion-allow] on the sweep so it survives the
// reduced-motion global override; motion carries meaning here.
// Static fallback: a pulsing dot instead of a rotating sweep.
// ============================================================

type Recommendation = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  impact_score: number | null;
  effort_score: number | null;
  competitor_id: string | null;
  created_at: string;
};

export default async function OpportunityRadar({
  competitor,
}: {
  competitor: Competitor;
}) {
  const supabase = await createClient();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("opportunity_recommendations")
    .select("*")
    .eq("brand_id", competitor.brand_id)
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false })
    .limit(30);

  const relevant = ((data as (Recommendation & { competitor_ids?: string[] | null })[] | null) ?? [])
    .filter((r) => {
      if (r.competitor_id === competitor.id) return true;
      if (Array.isArray(r.competitor_ids) && r.competitor_ids.includes(competitor.id)) return true;
      return `${r.title} ${r.description ?? ""}`
        .toLowerCase()
        .includes(competitor.name.toLowerCase());
    })
    .slice(0, 6);

  if (relevant.length === 0) {
    return (
      <section
        aria-label="Opportunity Radar"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-white/60 p-3 text-xs text-muted"
      >
        <span
          data-motion-allow
          className="relative inline-flex h-5 w-5 items-center justify-center"
          aria-hidden
        >
          <span className="absolute inset-0 rounded-full bg-accent/20 motion-safe:animate-ping" />
          <Radar className="relative h-3.5 w-3.5 text-accent" />
        </span>
        <span>
          Radar quiet — no new opportunities against {competitor.name} in the last 24 hours.
        </span>
      </section>
    );
  }

  return (
    <section
      aria-label="Opportunity Radar — high-signal moves surfaced in the last 24 hours"
      className="rounded-2xl border border-accent/20 bg-accent/5 p-3"
    >
      <header className="mb-2 flex items-center gap-2">
        <span data-motion-allow className="relative inline-flex h-5 w-5 items-center justify-center" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-accent/20 motion-safe:animate-ping" />
          <Radar className="relative h-3.5 w-3.5 text-accent" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          Opportunity Radar
        </p>
        <span className="text-[11px] text-muted">
          · {relevant.length} new signal{relevant.length === 1 ? "" : "s"} (24h)
        </span>
      </header>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        {relevant.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/w/opportunity/${r.id}/overview`}
            className="group flex min-w-[220px] max-w-[280px] shrink-0 snap-start flex-col gap-1 rounded-xl border border-line bg-white p-3 shadow-sm transition-colors hover:border-accent"
          >
            <p className="line-clamp-2 text-xs font-semibold text-ink group-hover:text-accent">
              {r.title}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              {r.impact_score != null && <span className="chip">Imp {r.impact_score}</span>}
              {r.effort_score != null && <span className="chip">Eff {r.effort_score}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
