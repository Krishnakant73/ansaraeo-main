"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Approval = {
  id: string;
  status: string;
  approver_role: string;
  task_id: string | null;
  created_at: string;
};

export default function ApprovalInbox({ approvals }: { approvals: Approval[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    try {
      const res = await fetch(`/api/workflow/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (approvals.length === 0) {
    return <p className="text-sm text-muted">No approvals yet.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {approvals.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              {a.task_id ? "Deployment approval" : "Content approval"}
            </p>
            <p className="text-xs text-muted">
              Requires role: <span className="font-medium text-ink">{a.approver_role}</span> ·{" "}
              {new Date(a.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {a.status === "pending" ? (
              <>
                <button
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => decide(a.id, "approved")}
                  className="btn-xs btn-xs-success"
                >
                  {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
                </button>
                <button
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => decide(a.id, "rejected")}
                  className="btn-xs btn-xs-ghost"
                >
                  <X className="h-3 w-3" /> Reject
                </button>
              </>
            ) : (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  a.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                )}
              >
                {a.status}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
