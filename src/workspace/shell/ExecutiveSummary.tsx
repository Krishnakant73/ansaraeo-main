import MetricsGrid from "../primitives/MetricsGrid";
import type { KPI, WorkspaceDescriptor } from "../core";

// ============================================================
// ExecutiveSummary — resolves the descriptor's summary(o) and
// renders the MetricsGrid. Async server component so Suspense
// upstream can stream it in independently of the tab body.
// ============================================================

export default async function ExecutiveSummary<T>({
  descriptor,
  object,
}: {
  descriptor: WorkspaceDescriptor<T>;
  object: T;
}) {
  const kpisMaybe = descriptor.summary(object);
  const kpis: KPI[] = await Promise.resolve(kpisMaybe);
  return (
    <section className="px-6 py-4">
      <MetricsGrid kpis={kpis} />
    </section>
  );
}
