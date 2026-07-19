import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import AiIndexClient from "@/app/dashboard/ai-index/AiIndexClient";

export const dynamic = "force-dynamic";

export default async function AiIndexPage({
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
        title={`AI Index Files — ${brand.name}`}
        subtitle='Generate the files AI answer engines look for — llms.txt, a robots.txt AI-welcome block, and Organization JSON-LD — built from your live site. Fill in any [ADD …] placeholders before publishing.'
      />
      <div className="mt-6">
        <AiIndexClient brandId={brand.id} />
      </div>
    </div>
  );
}
