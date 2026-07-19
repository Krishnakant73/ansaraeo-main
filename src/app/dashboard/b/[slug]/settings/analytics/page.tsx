import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import AnalyticsConnect from "@/app/dashboard/settings/analytics/AnalyticsConnect";

export const dynamic = "force-dynamic";

export default async function AnalyticsSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
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
