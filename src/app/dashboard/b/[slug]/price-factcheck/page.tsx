import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import PriceFactCheckClient from "@/app/dashboard/price-factcheck/PriceFactCheckClient";

export const dynamic = "force-dynamic";

export default async function PriceFactCheckPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return (
    <div>
      <PageHeader
        title="Price / Stock Fact-Check"
        subtitle="Samples AI engines with a buying question for your product, then fact-checks the price and stock the AI asserts for your brand against your true feed values, and ranks you against the competing retailers the AI actually names. Brand presence is a deterministic name check; engine sampling is failure-isolated. Analysis only — nothing is persisted."
      />
      <div className="mt-6">
        <PriceFactCheckClient />
      </div>
    </div>
  );
}
