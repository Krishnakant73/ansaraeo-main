import type { Engine } from "@/lib/engine-workspace";
import EngineCopilotCanvas from "./EngineCopilotCanvas.client";

export default function CopilotBody({ engine }: { engine: Engine }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about {engine.displayName}</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on {engine.displayName}&rsquo;s runs against {engine.brand.name}. It
          won&rsquo;t invent engine behavior or citations.
        </p>
      </div>
      <EngineCopilotCanvas
        engineName={engine.name}
        engineDisplay={engine.displayName}
        brandName={engine.brand.name}
      />
    </div>
  );
}
