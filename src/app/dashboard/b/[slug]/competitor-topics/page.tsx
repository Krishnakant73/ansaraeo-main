import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import CompetitorTopicsClient from "@/app/dashboard/competitor-topics/CompetitorTopicsClient";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";

export const dynamic = "force-dynamic";

export default async function CompetitorTopicsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const readiness = await getReadiness("competitor-topics", { brandId: brand.id });

  return (
    <div>
      <PageHeader
        title="Topical Coverage Gaps"
        subtitle="Crawls your sitemap and each competitor's sitemap, then compares the topics they cover that you don't — the highest-intent content gaps to close. Also shows the topics you own that competitors lack. Deterministic: topics come from real sitemap URL structure, never estimated."
      />
      {readiness.available && !readiness.state.justActivated && (
        <div className="mt-6">
          <DataReadinessCard
            title="Competitor Topics"
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
        <CompetitorTopicsClient brandId={brand.id} />
      </div>
    </div>
  );
}
