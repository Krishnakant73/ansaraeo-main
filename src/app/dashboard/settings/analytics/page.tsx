import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import AnalyticsConnect from "./AnalyticsConnect";

export default async function AnalyticsSettingsPage() {
  const supabase = await createClient();
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

  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider")
    .eq("brand_id", brand.id)
    .eq("status", "connected");

  const connectedProviders = new Set((integrations ?? []).map((i) => i.provider));

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Analytics & Revenue"
        subtitle={`Connect your own GA4 and Shopify accounts to see AI search → sessions → orders → revenue for ${brand.name}.`}
      />
      <div className="mt-6">
        <Panel title="Connections">
          <AnalyticsConnect
            brandId={brand.id}
            ga4Connected={connectedProviders.has("ga4")}
            shopifyConnected={connectedProviders.has("shopify")}
          />
        </Panel>
      </div>
    </div>
  );
}
