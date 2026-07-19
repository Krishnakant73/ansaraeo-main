import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import SchemaForAiClient from "@/app/dashboard/schema/SchemaForAiClient";

export const dynamic = "force-dynamic";

export default async function SchemaForAiPage({
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
        title="Schema-for-AI Generator"
        subtitle="Pick the schema.org type that matters for your pages, generate a template pre-filled with your brand name, then validate your JSON-LD. Validation is deterministic (no API key). Owner-only specifics stay as [ADD …] placeholders — fill them before publishing so engines cite accurate facts."
      />
      <div className="mt-6">
        <SchemaForAiClient
          brandId={brand.id}
          brandName={brand.name}
          domain={brand.domain ?? ""}
        />
      </div>
    </div>
  );
}
