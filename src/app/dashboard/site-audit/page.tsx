import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteAuditClient from "./SiteAuditClient";

export default async function SiteAuditPage() {
  const supabase = await createClient();
  const { data: brands } = await supabase.from("brands").select("id, name, domain").limit(1);
  const brand = brands?.[0];

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

  const { data: latestAudit } = await supabase
    .from("site_audits")
    .select("*")
    .eq("brand_id", brand.id)
    .order("run_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Site Audit — {brand.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Checking {brand.domain} for AI-bot crawlability, schema markup, and llms.txt.
      </p>
      <div className="mt-6">
        <SiteAuditClient brandId={brand.id} latestAudit={latestAudit ?? null} />
      </div>
    </div>
  );
}
