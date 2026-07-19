import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import PositioningClient from "./PositioningClient";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";

export const dynamic = "force-dynamic";

export default async function PositioningPage() {
  const { brand } = await getSelectedBrand();
  if (!brand) {
    return (
      <div className="text-sm text-muted">Add a brand first to set up its positioning.</div>
    );
  }
  const readiness = await getReadiness("brand-workspace", { brandId: brand.id });

  return (
    <div>
      <PageHeader
        title="Positioning"
        subtitle="Declare how you want to be seen — then see how AI actually describes you."
      />
      {readiness.available && !readiness.state.justActivated && (
        <div className="mt-6">
          <DataReadinessCard
            title="Brand Workspace"
            status={readiness.state.status}
            progress={readiness.state.percentage}
            confidence={readiness.state.confidence}
            requirements={readiness.state.requirements}
            estimatedCompletion={readiness.state.estimatedCompletion}
            message={readiness.state.message}
          />
        </div>
      )}
      <PositioningClient brandId={brand.id} />
    </div>
  );
}
