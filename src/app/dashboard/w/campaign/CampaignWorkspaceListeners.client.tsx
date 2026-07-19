"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// CampaignWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events. Handles:
//   campaign:mark-status  → PATCH /api/campaigns/[id] status
//   campaign:share        → clipboard.writeText(location.href)
// Keeps the descriptor RSC-serializable.
// ============================================================

export default function CampaignWorkspaceListeners({
  campaignId,
}: {
  campaignId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onSetStatus(e: Event) {
      const detail = (e as CustomEvent<{ campaignId?: string; status?: string }>).detail;
      if (detail?.campaignId && detail.campaignId !== campaignId) return;
      if (!detail?.status) return;
      try {
        await fetch(`/api/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: detail.status }),
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
    window.addEventListener("campaign:mark-status", onSetStatus);
    window.addEventListener("campaign:share", onShare);
    return () => {
      window.removeEventListener("campaign:mark-status", onSetStatus);
      window.removeEventListener("campaign:share", onShare);
    };
  }, [campaignId, router]);

  return null;
}
