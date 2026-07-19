import type { Opportunity } from "@/lib/opportunity-workspace";
import OpportunityCopilotCanvas from "./OpportunityCopilotCanvas.client";

export default function CopilotBody({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this opportunity</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on this opportunity&rsquo;s payload — never invents completion or numbers.
        </p>
      </div>
      <OpportunityCopilotCanvas
        opportunityId={opportunity.id}
        title={opportunity.title}
        brandName={opportunity.brand.name}
      />
    </div>
  );
}
