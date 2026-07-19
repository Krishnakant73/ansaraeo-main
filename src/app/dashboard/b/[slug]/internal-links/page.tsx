import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import InternalLinksClient from "@/app/dashboard/internal-links/InternalLinksClient";

export const dynamic = "force-dynamic";

export default async function InternalLinksPage({
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
        title="Internal Link Graph"
        subtitle="Crawls your sitemap and pages to map the internal-link graph — orphans, dead-ends, hubs, broken links — and runs a TF-IDF related-page suggestion pass plus a keyword-cannibalization audit (pages competing for the same query). Analysis only, up to 50 pages. Fixes come from real fetches of your own site, never estimated."
      />
      <div className="mt-6">
        <InternalLinksClient brandId={brand.id} />
      </div>
    </div>
  );
}
