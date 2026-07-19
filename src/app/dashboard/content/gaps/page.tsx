import Link from "next/link";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import ContentGapsClient from "./ContentGapsClient";

export default async function ContentGapsPage() {
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
        title={`Content Gaps — ${brand.name}`}
        subtitle="Questions where competitors get cited but you don't — your highest-intent content opportunities — plus AI-suggested new questions to target."
      />
      <div className="mt-6">
        <ContentGapsClient brandId={brand.id} />
      </div>
    </div>
  );
}
