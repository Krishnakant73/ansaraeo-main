import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import SiteAuditClient from "@/app/dashboard/site-audit/SiteAuditClient";

export const dynamic = "force-dynamic";

export default async function SiteAuditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: latestAudit } = await supabase
    .from("site_audits")
    .select("*")
    .eq("brand_id", brand.id)
    .order("run_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <div>
      <PageHeader
        title="Site Audit"
        subtitle={`Checking ${brand.domain} for AI-bot crawlability, schema markup, and llms.txt`}
      />
      <div className="mt-6">
        <SiteAuditClient brandId={brand.id} latestAudit={latestAudit ?? null} />
      </div>
    </div>
  );
}
