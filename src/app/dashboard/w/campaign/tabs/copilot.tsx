import type { Campaign } from "@/lib/campaign-workspace";
import CampaignCopilotCanvas from "./CampaignCopilotCanvas.client";

// ============================================================
// Campaign › Copilot — dedicated conversation surface. Same SSE
// contract, workspace context payload built from real campaign shape.
// ============================================================

export default function CopilotBody({ campaign }: { campaign: Campaign }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this campaign</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on {campaign.name}&rsquo;s missions and tasks. Never invents
          completions or dates.
        </p>
      </div>
      <CampaignCopilotCanvas
        campaignId={campaign.id}
        campaignName={campaign.name}
        brandName={campaign.brand.name}
      />
    </div>
  );
}
