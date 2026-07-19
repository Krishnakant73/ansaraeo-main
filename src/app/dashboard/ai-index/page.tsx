import Link from "next/link";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import AiIndexClient from "./AiIndexClient";

export default async function AiIndexPage() {
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
        title={`AI Index Files — ${brand.name}`}
        subtitle='Generate the files AI answer engines look for — llms.txt, a robots.txt AI-welcome block, and Organization JSON-LD — built from your live site. Fill in any [ADD …] placeholders before publishing.'
      />
      <div className="mt-6">
        <AiIndexClient brandId={brand.id} />
      </div>
    </div>
  );
}
