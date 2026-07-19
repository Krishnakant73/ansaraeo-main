import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { listApprovals } from "@/lib/workflow";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import ApprovalInbox from "@/components/dashboard/workflow/ApprovalInbox";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
  const [pending, decided] = await Promise.all([
    listApprovals(brand.id, { status: "pending" }, supabase),
    listApprovals(brand.id, { status: "approved" }, supabase),
  ]);

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Role-gated sign-off before anything deploys. Approved deployments unblock the linked task."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title={`Pending (${pending.length})`}>
          <ApprovalInbox approvals={pending as any} />
        </Panel>
        <Panel title={`Recently decided (${decided.length})`}>
          <ApprovalInbox approvals={decided as any} />
        </Panel>
      </div>
    </div>
  );
}
