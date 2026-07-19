import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { listApprovals } from "@/lib/workflow";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import ApprovalInbox from "@/components/dashboard/workflow/ApprovalInbox";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="No brand selected"
        description="Select or create a brand to see approval requests."
      />
    );
  }

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
