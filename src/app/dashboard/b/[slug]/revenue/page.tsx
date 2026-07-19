import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import RevenueAttributionClient from "@/app/dashboard/revenue/RevenueAttributionClient";

export const dynamic = "force-dynamic";

export default async function RevenuePage({
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
        title={`Revenue Attribution — ${brand.name}`}
        subtitle="AI search → sessions → orders → revenue, in one view."
        actions={
          <Link href={`/dashboard/b/${slug}/settings/analytics`} className="btn-secondary !h-10 !px-5">
            Manage connections
          </Link>
        }
      />
      <div className="mt-6">
        <RevenueAttributionClient brandId={brand.id} />
      </div>
    </div>
  );
}
