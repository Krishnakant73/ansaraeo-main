import Link from "next/link";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import RevenueAttributionClient from "./RevenueAttributionClient";

export default async function RevenuePage() {
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
        title={`Revenue Attribution — ${brand.name}`}
        subtitle="AI search → sessions → orders → revenue, in one view."
        actions={
          <Link href="/dashboard/settings/analytics" className="btn-secondary !h-10 !px-5">
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
