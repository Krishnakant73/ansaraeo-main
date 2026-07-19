import CitationExplorer from "../features/CitationExplorer";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Citations — Citation Explorer body. Two-column layout:
// left column is the domain ranking, right column drills into
// the selected domain (?domain=<name>).
//
// Replaces the old `sources.tsx` (deleted in this migration).
// ============================================================

export default async function CitationsBody({
  engine,
  searchParams,
}: {
  engine: Engine;
  searchParams?: URLSearchParams;
}) {
  const activeDomain = searchParams?.get("domain") ?? undefined;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-ink">Citations from {engine.displayName}</h2>
        <p className="mt-1 text-sm text-muted">
          Domains {engine.displayName} pulls from when answering questions about{" "}
          {engine.brand.name}.{" "}
          {!engine.meta.cites && (
            <span className="italic">
              {engine.displayName} rarely surfaces citations — expect sparse data.
            </span>
          )}
        </p>
      </header>
      <CitationExplorer engine={engine} activeDomain={activeDomain} />
    </div>
  );
}
