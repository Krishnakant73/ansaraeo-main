import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/panel";
import OpportunityQueue from "@/components/dashboard/workflow/OpportunityQueue";
import type { Prompt } from "@/lib/prompt-workspace";

// ============================================================
// Prompt › Recommendations — opportunity queue scoped to this prompt.
// Filters the brand's opportunity queue to those whose detail JSONB
// references this prompt_id. Falls back to the full brand queue if
// prompt-scoped filtering isn't available in the source schema.
// ============================================================

type OppRow = {
  id: string;
  type: string;
  title: string;
  detail: { prompt_id?: string } | null;
  estimated_impact: Record<string, unknown> | null;
  priority_score: number | null;
  status: string;
};

export default async function RecommendationsBody({ prompt }: { prompt: Prompt }) {
  const supabase = await createClient();
  let opportunities: OppRow[] = [];
  try {
    const { data } = await supabase
      .from("opportunity_recommendations")
      .select("id, type, title, detail, estimated_impact, priority_score, status")
      .eq("brand_id", prompt.brand_id)
      .eq("status", "open")
      .order("priority_score", { ascending: false })
      .limit(50);
    opportunities = (data as OppRow[] | null) ?? [];
  } catch {
    /* table absent — empty state renders */
  }

  // Best-effort prompt filter — keep opportunities that either explicitly
  // reference this prompt in detail.prompt_id, or don't reference any prompt
  // (brand-wide wins that still apply here).
  const scoped = opportunities.filter((o) => {
    const pid = o.detail?.prompt_id;
    return !pid || pid === prompt.id;
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Recommendations</h2>
        <p className="mt-1 text-sm text-muted">
          Ways to improve how AI engines answer this prompt for {prompt.brand.name}. Accept
          one to create a mission with a fix → verify task sequence.
        </p>
      </div>
      <Panel title={`Open opportunities (${scoped.length})`}>
        {scoped.length === 0 ? (
          <p className="text-sm text-muted">
            No open gaps on this prompt right now. Try running a fresh scan or check the
            Optimization tab.
          </p>
        ) : (
          <OpportunityQueue
            opportunities={scoped.map((o) => ({
              id: o.id,
              type: o.type,
              title: o.title,
              estimated_impact: o.estimated_impact,
              priority_score: o.priority_score,
              status: o.status,
            }))}
          />
        )}
      </Panel>
    </div>
  );
}
