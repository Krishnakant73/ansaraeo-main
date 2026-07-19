import type { Playbook } from "@/lib/playbook-workspace";
import PlaybookCopilotCanvas from "./PlaybookCopilotCanvas.client";

export default function CopilotBody({ playbook }: { playbook: Playbook }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this playbook</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the playbook row + steps. Never invents runs.
        </p>
      </div>
      <PlaybookCopilotCanvas
        playbookId={playbook.id}
        playbookName={playbook.name}
        orgName={playbook.org.name ?? "org"}
        trigger={playbook.trigger_type}
        stepCount={playbook.stats.stepCount}
      />
    </div>
  );
}
