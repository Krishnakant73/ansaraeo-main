import { createClient } from "@/lib/supabase/server";
import { listOpportunities } from "@/lib/workflow";
import { Panel } from "@/components/dashboard/panel";
import OpportunityQueue from "@/components/dashboard/workflow/OpportunityQueue";
import type { Brand } from "@/lib/selected-brand";

// ============================================================
// Brand › Recommendations — the "what should I do next" tab.
// Reads open opportunities via listOpportunities (same source as
// Intelligence page). Kept intentionally single-concern: the list
// is the whole tab; drilling into any row jumps to that mission.
// ============================================================

export default async function RecommendationsBody({ brand }: { brand: Brand }) {
  const supabase = await createClient();
  const opportunities = await listOpportunities(brand.id, { status: "open" }, supabase);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Recommendations</h2>
        <p className="mt-1 text-sm text-muted">
          Gaps between {brand.name} and the anonymous benchmark. Accept one to
          create a mission with a fix → verify task sequence.
        </p>
      </div>
      <Panel title={`Open opportunities (${opportunities.length})`}>
        <OpportunityQueue
          opportunities={opportunities.map((o) => ({
            id: o.id,
            type: o.type,
            title: o.title,
            estimated_impact: o.estimated_impact,
            priority_score: o.priority_score,
            status: o.status,
          }))}
        />
      </Panel>
    </div>
  );
}
