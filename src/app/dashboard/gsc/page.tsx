import { getSelectedBrand } from "@/lib/selected-brand";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import GscClient from "./GscClient";

export default async function GscPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { brand } = await getSelectedBrand();
  if (!brand) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">Set up a brand first.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("integrations")
    .select("provider")
    .eq("brand_id", brand.id)
    .eq("provider", "gsc")
    .maybeSingle();
  const connected = Boolean(data);

  const sp = await searchParams;
  const flash = sp.connected ? "connected" : sp.error ? sp.error : undefined;

  const defaultSite = brand.domain?.startsWith("http") ? brand.domain : `https://${brand.domain ?? ""}`;

  return (
    <div>
      <PageHeader
        title="GSC Index Monitor"
        subtitle="Connect your Google Search Console property to check the live index status of every sitemap URL via the URL Inspection API, get alerted when pages drop out of the index, and request reindexing on demand. Your OAuth refresh token is stored encrypted — we never auto-reindex."
      />
      <div className="mt-6">
        <GscClient brandId={brand.id} connected={connected} defaultSite={defaultSite} flash={flash} />
      </div>
    </div>
  );
}
