import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import SchemaForAiClient from "./SchemaForAiClient";

export default async function SchemaForAiPage() {
  const { brand } = await getSelectedBrand();

  return (
    <div>
      <PageHeader
        title="Schema-for-AI Generator"
        subtitle="Pick the schema.org type that matters for your pages, generate a template pre-filled with your brand name, then validate your JSON-LD. Validation is deterministic (no API key). Owner-only specifics stay as [ADD …] placeholders — fill them before publishing so engines cite accurate facts."
      />
      <div className="mt-6">
        <SchemaForAiClient
          brandId={brand?.id ?? null}
          brandName={brand?.name ?? ""}
          domain={brand?.domain ?? ""}
        />
      </div>
    </div>
  );
}
