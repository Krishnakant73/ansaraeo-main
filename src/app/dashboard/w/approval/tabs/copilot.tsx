import { targetLabel, type Approval } from "@/lib/approval-workspace";
import ApprovalCopilotCanvas from "./ApprovalCopilotCanvas.client";

export default function CopilotBody({ approval }: { approval: Approval }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this approval</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the approval row + its target. Never approves on your behalf.
        </p>
      </div>
      <ApprovalCopilotCanvas
        approvalId={approval.id}
        targetLabel={targetLabel(approval.target)}
        approverRole={approval.approver_role}
        status={approval.status}
        brandName={approval.brand.name}
      />
    </div>
  );
}
