import Link from "next/link";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import PdpClient from "./PdpClient";

export default async function PdpPage() {
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">Set up a brand first.</p>
        <Link href="/dashboard/onboarding" className="btn-primary mt-4 inline-flex">
          Start setup
        </Link>
      </div>
    );
  }

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
