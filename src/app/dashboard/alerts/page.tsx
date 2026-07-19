import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import AlertsClient from "./AlertsClient";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { brand } = await getSelectedBrand();
  if (!brand) {
    return (
      <div className="text-sm text-muted">Add a brand first to set up alert rules.</div>
    );
  }
  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Get notified when a metric drops, worsens, or spikes vs its prior window."
      />
      <AlertsClient brandId={brand.id} />
    </div>
  );
}
