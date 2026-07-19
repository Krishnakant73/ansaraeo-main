import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";

export const dynamic = "force-dynamic";

export default async function OrgPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div>
        <PageHeader title="Organization" subtitle="Your workspace and plan" />
        <p className="mt-6 text-sm text-muted">Sign in to view your organization.</p>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, plan, billing_provider, created_at")
    .eq("id", membership?.org_id)
    .single();

  const [{ count: brandCount }, { count: memberCount }] = await Promise.all([
    supabase.from("brands").select("*", { count: "exact", head: true }).eq("org_id", membership?.org_id ?? ""),
    supabase.from("org_members").select("*", { count: "exact", head: true }).eq("org_id", membership?.org_id ?? ""),
  ]);

  return (
    <div>
      <PageHeader title="Organization" subtitle="Your workspace and plan" />
      <div className="mt-6 max-w-xl space-y-6">
        <Panel title="Workspace">
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Name</dt>
              <dd className="font-medium text-ink">{org?.name ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Plan</dt>
              <dd className="font-medium capitalize text-ink">{org?.plan ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Billing provider</dt>
              <dd className="font-medium capitalize text-ink">{org?.billing_provider ?? "Not connected"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Brands</dt>
              <dd className="font-medium text-ink">{brandCount ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Members</dt>
              <dd className="font-medium text-ink">{memberCount ?? 0}</dd>
            </div>
            {org?.created_at && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Created</dt>
                <dd className="font-medium text-ink">{new Date(org.created_at).toLocaleDateString("en-IN")}</dd>
              </div>
            )}
          </dl>
        </Panel>
        <p className="text-xs text-muted">
          To change your plan or billing details, visit{" "}
          <a href="/dashboard/settings/billing" className="font-medium text-accent hover:underline">
            Plan &amp; Billing
          </a>
          .
        </p>
      </div>
    </div>
  );
}
