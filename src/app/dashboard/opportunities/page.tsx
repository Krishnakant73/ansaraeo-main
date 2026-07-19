import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { listOpportunities } from "@/lib/workflow";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import OpportunityQueue from "@/components/dashboard/workflow/OpportunityQueue";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="No brand selected"
        description="Select or create a brand to see its opportunity queue."
      />
    );
  }

  const opportunities = await listOpportunities(brand.id, { status: "open" }, supabase);

  return (
    <div>
      <PageHeader
        title="Opportunity Queue"
        subtitle="Gaps between your brand and the anonymous benchmark. Accept one to create a mission with a fix → verify task sequence."
      />
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
