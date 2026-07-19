import HistoryClient from "@/app/dashboard/history/HistoryClient";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";
import type { Brand } from "@/lib/selected-brand";

// ============================================================
// Brand › History — every AI-engine interaction as immutable
// historical knowledge. Wraps the existing HistoryClient — no
// duplicated fetch logic; the client component owns paging.
// ============================================================

export default async function HistoryBody({ brand }: { brand: Brand }) {
  const readiness = await getReadiness("history", { brandId: brand.id });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">History</h2>
        <p className="mt-1 text-sm text-muted">
          Every AI-engine interaction for {brand.name}, stored as immutable
          historical knowledge.
        </p>
      </div>
      {readiness.available && !readiness.state.justActivated && (
        <DataReadinessCard
          title="History Engine"
          status={readiness.state.status}
          progress={readiness.state.percentage}
          confidence={readiness.state.confidence}
          requirements={readiness.state.requirements}
          estimatedCompletion={readiness.state.estimatedCompletion}
          message={readiness.state.message}
        />
      )}
      <HistoryClient brandId={brand.id} brandName={brand.name} />
    </div>
  );
}
