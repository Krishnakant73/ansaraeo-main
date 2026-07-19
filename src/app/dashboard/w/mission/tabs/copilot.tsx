import type { Mission } from "@/lib/mission-workspace";
import MissionCopilotCanvas from "./MissionCopilotCanvas.client";

// ============================================================
// Mission › Copilot — dedicated conversation surface.
// ============================================================

export default function CopilotBody({ mission }: { mission: Mission }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this mission</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on {mission.title}&rsquo;s tasks and approvals. It never invents
          completions or blockers.
        </p>
      </div>
      <MissionCopilotCanvas
        missionId={mission.id}
        missionTitle={mission.title}
        brandName={mission.brand.name}
      />
    </div>
  );
}
