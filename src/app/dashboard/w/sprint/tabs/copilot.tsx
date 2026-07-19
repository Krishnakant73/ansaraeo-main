import type { Sprint } from "@/lib/sprint-workspace";
import SprintCopilotCanvas from "./SprintCopilotCanvas.client";

export default function CopilotBody({ sprint }: { sprint: Sprint }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this sprint</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on {sprint.name}&rsquo;s missions and burndown. Never invents
          completions or a schedule that doesn&rsquo;t exist.
        </p>
      </div>
      <SprintCopilotCanvas
        sprintId={sprint.id}
        sprintName={sprint.name}
        brandName={sprint.brand.name}
      />
    </div>
  );
}
