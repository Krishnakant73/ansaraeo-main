"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// ApprovalWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events:
//   approval:mark-status → PATCH /api/approvals/[id] { status }
//   approval:share       → clipboard.writeText(location.href)
// The PATCH endpoint stamps decided_by + decided_at automatically.
// ============================================================

export default function ApprovalWorkspaceListeners({
  approvalId,
}: {
  approvalId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onSetStatus(e: Event) {
      const detail = (e as CustomEvent<{ approvalId?: string; status?: string; note?: string }>).detail;
      if (detail?.approvalId && detail.approvalId !== approvalId) return;
      if (!detail?.status) return;
      try {
        const body: Record<string, unknown> = { status: detail.status };
        if (detail.status === "rejected") {
          const note = window.prompt("Rejection reason (visible to requester):", detail.note ?? "");
          if (!note) return; // cancelled
          body.note = note.trim();
        }
        await fetch(`/api/approvals/${approvalId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        router.refresh();
      } catch {
        /* silent */
      }
    }
    async function onShare() {
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(window.location.href);
      } catch {
        /* silent */
      }
    }
    window.addEventListener("approval:mark-status", onSetStatus);
    window.addEventListener("approval:share", onShare);
    return () => {
      window.removeEventListener("approval:mark-status", onSetStatus);
      window.removeEventListener("approval:share", onShare);
    };
  }, [approvalId, router]);

  return null;
}
