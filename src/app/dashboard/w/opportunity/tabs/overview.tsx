import Link from "next/link";
import InsightCard from "@/workspace/primitives/InsightCard";
import { opportunityTypeLabel, timeAgo, type Opportunity } from "@/lib/opportunity-workspace";

// ============================================================
// Opportunity › Overview — what, why, expected impact, next step.
// The queue-row copy expanded into a real workspace: shows the
// detail JSONB, related prompt, and any mission spawned from this
// opportunity.
// ============================================================

export default function OverviewBody({ opportunity }: { opportunity: Opportunity }) {
  const priority = opportunity.priority_score ?? 0;
  const priorityPct = Math.round(priority * 100);
  const mentionsImpact = opportunity.estimated_impact?.mentions_per_month;
  const visibilityDelta = opportunity.estimated_impact?.visibility_delta;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">{opportunityTypeLabel(opportunity.type)}</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{opportunity.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={
                opportunity.status === "open"
                  ? "chip border-amber-200 bg-amber-50 text-amber-700"
                  : opportunity.status === "done"
                    ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                    : opportunity.status === "dismissed"
                      ? "chip"
                      : "chip"
              }>
                {opportunity.status}
              </span>
              <span className="chip">Priority {priorityPct}%</span>
              <span className="chip">Created {timeAgo(opportunity.created_at)}</span>
            </div>
          </div>
          <div className="shrink-0">
            <div className="h-14 w-14 rounded-full bg-accent/10 grid place-items-center">
              <span className="text-lg font-bold text-accent">{priorityPct}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Impact */}
      {(mentionsImpact || visibilityDelta) && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Estimated impact</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {mentionsImpact != null && (
              <div>
                <p className="text-2xl font-bold tracking-tight text-emerald-600">
                  +{mentionsImpact}
                </p>
                <p className="text-xs text-muted">mentions per month</p>
              </div>
            )}
            {visibilityDelta != null && (
              <div>
                <p className="text-2xl font-bold tracking-tight text-emerald-600">
                  +{typeof visibilityDelta === "number" ? visibilityDelta.toFixed(1) : String(visibilityDelta)}pp
                </p>
                <p className="text-xs text-muted">visibility rate</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Next step */}
      {opportunity.status === "open" && (
        <InsightCard
          variant="opportunity"
          title="Accept to create a mission"
          description="A fix → verify task sequence will be generated from this opportunity type. The verify task confirms the gap closed."
        />
      )}
      {opportunity.related.linkedMissionId && (
        <InsightCard
          variant="info"
          title={`Mission in flight · ${opportunity.related.linkedMissionTitle}`}
          description="This opportunity has already been accepted. Track progress on the mission workspace."
          href={`/dashboard/w/mission/${opportunity.related.linkedMissionId}/overview`}
          meta="Mission"
        />
      )}
      {opportunity.status === "dismissed" && (
        <InsightCard
          variant="info"
          title="Dismissed"
          description="You skipped this opportunity. It won't resurface in the queue."
        />
      )}
      {opportunity.status === "done" && (
        <InsightCard
          variant="win"
          title="Closed"
          description="The verify step confirmed this gap closed."
        />
      )}

      {/* Context strip */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title={`Brand · ${opportunity.brand.name}`}
          description="Open the brand workspace to see the full opportunity queue."
          href={`/dashboard/w/brand/${opportunity.brand.slug}/recommendations`}
          meta="Brand"
        />
        {opportunity.related.prompt && (
          <InsightCard
            variant="info"
            title="Target prompt"
            description={opportunity.related.prompt.text.slice(0, 120)}
            href={`/dashboard/w/prompt/${opportunity.related.prompt.id}/overview`}
            meta="Prompt"
          />
        )}
      </div>
    </div>
  );
}
