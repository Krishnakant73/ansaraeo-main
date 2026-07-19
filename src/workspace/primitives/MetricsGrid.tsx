import KpiCard from "./KpiCard";
import type { KPI } from "../core";

// ============================================================
// MetricsGrid — responsive grid of KPI tiles.
// 1 col mobile · 2 col tablet · 4 col desktop.
// ============================================================

export default function MetricsGrid({ kpis }: { kpis: KPI[] }) {
  if (kpis.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => (
        <KpiCard key={k.key} kpi={k} />
      ))}
    </div>
  );
}
