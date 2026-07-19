import type { Prompt } from "@/lib/prompt-workspace";
import PromptCopilotCanvas from "./PromptCopilotCanvas.client";

// ============================================================
// Prompt › Copilot — a dedicated conversation surface for this prompt.
// The docked CopilotDock elsewhere in the shell already reads the
// workspace's DOM copilot-context; this tab gives the operator more
// canvas + suggested-prompt affordances specifically for the prompt.
// ============================================================

export default function CopilotBody({ prompt }: { prompt: Prompt }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this prompt</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on this prompt&rsquo;s history and citations. It never invents
          engine behavior — if the data doesn&rsquo;t back an answer, it will say so.
        </p>
      </div>
      <PromptCopilotCanvas
        promptId={prompt.id}
        promptText={prompt.text}
        brandName={prompt.brand.name}
      />
    </div>
  );
}
