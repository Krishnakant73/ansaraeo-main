import AiChangeLog from "../features/AiChangeLog";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Model Changes — the AI Change Log body.
//
// Deterministic drift detectors + any manual annotations from
// engine_change_events, rendered as a timeline.
// ============================================================

export default function ModelChangesBody({ engine }: { engine: Engine }) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-ink">Model changes on {engine.displayName}</h2>
        <p className="mt-1 text-sm text-muted">
          Behavior shifts detected in the engine&rsquo;s answering pattern for {engine.brand.name}
          — plus any manual annotations from the team.
        </p>
      </header>
      <AiChangeLog engine={engine} />
    </div>
  );
}
