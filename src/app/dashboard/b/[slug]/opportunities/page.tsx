import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { listOpportunities } from "@/lib/workflow";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import OpportunityQueue from "@/components/dashboard/workflow/OpportunityQueue";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
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
