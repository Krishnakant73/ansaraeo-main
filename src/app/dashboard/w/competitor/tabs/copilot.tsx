import type { Competitor } from "@/lib/competitor-workspace";
import CompetitorCopilotCanvas from "./CompetitorCopilotCanvas.client";

// ============================================================
// Competitor › Copilot — dedicated Copilot conversation surface
// grounded on this competitor. Uses the same SSE contract as the
// docked Copilot / Prompt Copilot canvas.
// ============================================================

export default function CopilotBody({ competitor }: { competitor: Competitor }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this competitor</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on {competitor.name}&rsquo;s mention history and citations against{" "}
          {competitor.brand.name}. It never invents competitor moves.
        </p>
      </div>
      <CompetitorCopilotCanvas
        competitorId={competitor.id}
        competitorName={competitor.name}
        brandName={competitor.brand.name}
      />
    </div>
  );
}
