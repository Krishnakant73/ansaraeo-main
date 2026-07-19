import type { Automation } from "@/lib/automation-workspace";
import AutomationCopilotCanvas from "./AutomationCopilotCanvas.client";

export default function CopilotBody({ automation }: { automation: Automation }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this automation</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the trigger + actions payload. Never invents firing history.
        </p>
      </div>
      <AutomationCopilotCanvas
        automationId={automation.id}
        name={automation.name}
        brandName={automation.brand.name}
      />
    </div>
  );
}
