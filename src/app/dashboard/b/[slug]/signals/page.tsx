import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import SignalsClient from "@/app/dashboard/signals/SignalsClient";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";

export const dynamic = "force-dynamic";

export default async function SignalsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const readiness = await getReadiness("consumer-insights", { brandId: brand.id });

  return (
    <div>
      <PageHeader
        title={`Brand Signals — ${brand.name}`}
        subtitle="Where your brand is being discussed on Reddit and YouTube — the community and video sources AI answer engines cite most. Seed and earn these mentions to grow AI visibility."
      />
      {readiness.available && !readiness.state.justActivated && (
        <div className="mt-6">
          <DataReadinessCard
            title="Consumer Insights"
            status={readiness.state.status}
            progress={readiness.state.percentage}
            confidence={readiness.state.confidence}
            requirements={readiness.state.requirements}
            estimatedCompletion={readiness.state.estimatedCompletion}
            message={readiness.state.message}
          />
        </div>
      )}
      <div className="mt-6">
        <SignalsClient brandId={brand.id} />
      </div>
    </div>
  );
}
