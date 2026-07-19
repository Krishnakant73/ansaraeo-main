import AiPersonalityProfile from "../features/AiPersonalityProfile";
import AiDnaRadar from "../features/AiDnaRadar";
import RecommendationReplay from "../features/RecommendationReplay";
import EngineComparison from "../features/EngineComparison";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Behavior — the deep-dive on how this AI thinks.
// Wraps: AiPersonalityProfile (six axes with guidance), AiDnaRadar
// (this engine vs the brand's cross-engine baseline), a live
// RecommendationReplay from the latest run, and a sibling-engine
// comparison chart.
//
// This is the "How does this AI think?" tab. Every card must be
// backed by real data — empty states surface EmptyStateCoach.
// ============================================================

export default function BehaviorBody({ engine }: { engine: Engine }) {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-ink">How {engine.displayName} thinks</h2>
        <p className="mt-1 text-sm text-muted">
          Deterministic personality scoring, cross-engine positioning, and a live replay of the
          most recent answer for {engine.brand.name}.
        </p>
      </header>

      <AiPersonalityProfile engine={engine} />
      <AiDnaRadar engine={engine} />
      <RecommendationReplay engine={engine} />
      <EngineComparison engine={engine} />
    </div>
  );
}
