import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InsightCard from "@/workspace/primitives/InsightCard";
import { EmptyStateCoach } from "@/workspace/primitives";
import { intentFunnelStage } from "@/lib/intent";
import type { Prompt } from "@/lib/prompt-workspace";

// ============================================================
// Prompt › Overview — "today's answer" + trend strip + 3 fastest wins.
// Reads the newest run per engine and gives a 15-second read of state.
// ============================================================

type LatestRow = {
  id: string;
  run_at: string;
  engine_id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  raw_response: string | null;
};

type OppRow = {
  id: string;
  title: string;
  type: string;
  priority_score: number | null;
  estimated_impact: { mentions_per_month?: number } | null;
};

export default async function OverviewBody({ prompt }: { prompt: Prompt }) {
  const supabase = await createClient();

  // Recent runs — bounded so we can dedup client-side to latest-per-engine.
  const [runsRes, enginesRes] = await Promise.all([
    supabase
      .from("visibility_runs")
      .select("id, run_at, engine_id, brand_mentioned, brand_position, sentiment, raw_response")
      .eq("prompt_id", prompt.id)
      .order("run_at", { ascending: false })
      .limit(50),
    supabase.from("engines").select("id, name"),
  ]);

  const engines = new Map<string, string>();
  for (const e of (enginesRes.data as { id: string; name: string }[] | null) ?? []) {
    engines.set(e.id, e.name);
  }

  const latestPerEngine = new Map<string, LatestRow>();
  for (const r of (runsRes.data as LatestRow[] | null) ?? []) {
    if (!latestPerEngine.has(r.engine_id)) latestPerEngine.set(r.engine_id, r);
  }

  // Top 3 open opportunities for this prompt (best-effort — table may not exist
  // pre-migration or may not carry prompt_id in every schema).
  let opps: OppRow[] = [];
  try {
    const { data } = await supabase
      .from("opportunity_recommendations")
      .select("id, title, type, priority_score, estimated_impact")
      .eq("brand_id", prompt.brand_id)
      .neq("status", "dismissed")
      .order("priority_score", { ascending: false })
      .limit(3);
    opps = (data as OppRow[] | null) ?? [];
  } catch {
    /* opportunities table absent — degrade quietly */
  }

  const funnel = intentFunnelStage(prompt.intent);

  return (
    <div className="space-y-6">
      {/* Full prompt text — the object itself, shown once at the top */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <p className="section-label">The prompt</p>
        <p className="mt-1 text-base font-medium leading-relaxed text-ink">
          &ldquo;{prompt.text}&rdquo;
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="chip">{prompt.language.toUpperCase()}</span>
          {funnel && (
            <span className="chip">
              {funnel === "top" ? "Top of funnel" : funnel === "middle" ? "Middle" : "Bottom of funnel"}
            </span>
          )}
          {prompt.priority && <span className="chip chip-accent">★ Priority</span>}
        </div>
      </section>

      {/* Today's answer — newest run per engine */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Today&rsquo;s answer</h2>
          <span className="text-xs text-muted">
            {latestPerEngine.size > 0 ? `${latestPerEngine.size} engines answered` : "no runs yet"}
          </span>
        </div>
        {latestPerEngine.size === 0 ? (
          <EmptyStateCoach
            variant="coach"
            title="No runs for this prompt yet"
            description="Press E to run a scan across every active engine — the first result seeds mention rate, sentiment, and citation data for this prompt."
            action={{
              label: "Open History",
              href: `/dashboard/w/prompt/${prompt.id}/history`,
            }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(latestPerEngine.entries()).map(([engineId, r]) => {
              const engineName = engines.get(engineId) ?? "unknown";
              const mentioned = r.brand_mentioned === true;
              const skipped = r.brand_mentioned === null;
              const snippet = (r.raw_response ?? "").slice(0, 180);
              return (
                <Link
                  key={r.id}
                  href={`/dashboard/w/prompt/${prompt.id}/history?run=${r.id}`}
                  className="group flex flex-col gap-2 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="section-label capitalize">{engineName.replace(/_/g, " ")}</span>
                    <span
                      className={
                        skipped
                          ? "chip"
                          : mentioned
                            ? "chip chip-accent"
                            : "chip border-rose-200 bg-rose-50 text-rose-600"
                      }
                    >
                      {skipped ? "skipped" : mentioned ? "mentioned ✓" : "not mentioned"}
                    </span>
                  </div>
                  {r.brand_position != null && (
                    <p className="text-xs text-muted">
                      Position <span className="font-semibold text-ink">#{r.brand_position}</span>
                      {r.sentiment && <> · {r.sentiment}</>}
                    </p>
                  )}
                  {snippet && (
                    <p className="line-clamp-3 text-xs text-muted">
                      {snippet}
                      {(r.raw_response ?? "").length > 180 ? "…" : ""}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 3 fastest wins */}
      {opps.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Fastest wins</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {opps.map((o) => (
              <InsightCard
                key={o.id}
                variant="opportunity"
                title={o.title}
                description={
                  o.estimated_impact?.mentions_per_month
                    ? `Est. +${o.estimated_impact.mentions_per_month} mentions/mo`
                    : undefined
                }
                meta={`${Math.round((o.priority_score ?? 0) * 100)}% priority`}
                href={`/dashboard/w/brand/${prompt.brand.slug}/recommendations`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
