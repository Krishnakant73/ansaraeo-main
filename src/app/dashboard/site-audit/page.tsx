import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import SiteAuditClient from "./SiteAuditClient";

export default async function SiteAuditPage() {
  const supabase = await createClient();
  const { data: brands } = await supabase.from("brands").select("id, name, domain").limit(1);
  const brand = brands?.[0];

  if (!brand) {
    return (
      <div>
        <PageHeader
          title="Site Audit"
          subtitle="Checking your site for AI-bot crawlability, schema markup, and llms.txt"
        />
        <div className="empty">
          <p className="text-sm text-muted">Set up a brand first.</p>
          <Link href="/dashboard/onboarding" className="btn-primary mt-5">
            Start setup
          </Link>
        </div>
      </div>
    );
  }

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
