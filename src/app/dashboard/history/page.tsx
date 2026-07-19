import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import HistoryClient from "./HistoryClient";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { brand } = await getSelectedBrand();
  if (!brand) {
    return (
      <div>
        <PageHeader
          title="History"
          subtitle="Your brand's immutable record of every AI-engine recommendation."
        />
        <div className="empty">
          <p className="text-sm text-muted">Add a brand first to start capturing history.</p>
        </div>
      </div>
    );
  }
  const readiness = await getReadiness("history", { brandId: brand.id });

  return (
    <div>
      <PageHeader
        title="History"
        subtitle={`Every AI-engine interaction for ${brand.name}, stored as immutable historical knowledge.`}
      />
      {readiness.available && !readiness.state.justActivated && (
        <div className="mt-6">
          <DataReadinessCard
            title="History Engine"
            status={readiness.state.status}
            progress={readiness.state.percentage}
            confidence={readiness.state.confidence}
            requirements={readiness.state.requirements}
            estimatedCompletion={readiness.state.estimatedCompletion}
            message={readiness.state.message}
          />
        </div>
      )}
      <HistoryClient brandId={brand.id} brandName={brand.name} />
    </div>
  );
}
