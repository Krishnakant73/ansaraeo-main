import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import PdpClient from "@/app/dashboard/pdp/PdpClient";

export const dynamic = "force-dynamic";

export default async function PdpPage({
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
        title={`PDP Generator — ${brand.name}`}
        subtitle="Turn a product page URL (or pasted product JSON) into a schema.org Product JSON-LD block and AI-citation-optimized copy. Real facts are extracted and cited; owner-only specifics stay as [ADD …] placeholders."
      />
      <div className="mt-6">
        <PdpClient brandId={brand.id} />
      </div>
    </div>
  );
}
