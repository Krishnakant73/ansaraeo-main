import OptimizationStrategyGenerator from "../features/OptimizationStrategyGenerator";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Optimization — the Optimization Strategy Generator body.
//
// Client component fetches the deterministic recipe from
// /api/v1/engines/[name]/strategy and lets the user "Add all to
// Battle Plan" (idempotent by (brand, engine, kind)).
// ============================================================

export default function OptimizationBody({ engine }: { engine: Engine }) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-ink">
          Optimize for {engine.displayName}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Deterministic playbook tuned to how {engine.displayName} discovers, evaluates, and cites
          brands. Direction over precision — every move is defensible.
        </p>
      </header>
      <OptimizationStrategyGenerator
        engineName={engine.name}
        engineDisplay={engine.displayName}
        brandSlug={engine.brand.slug}
      />
    </div>
  );
}
