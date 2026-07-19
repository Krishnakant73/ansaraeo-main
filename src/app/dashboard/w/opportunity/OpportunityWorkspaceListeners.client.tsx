"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// OpportunityWorkspaceListeners — bridges descriptor events:
//   opportunity:accept   → POST /api/workflow/opportunities/accept
//   opportunity:dismiss  → POST /api/opportunities/skip
//   opportunity:share    → clipboard copy
// ============================================================

export default function OpportunityWorkspaceListeners({
  opportunityId,
  brandId,
}: {
  opportunityId: string;
  brandId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onAccept(e: Event) {
      const detail = (e as CustomEvent<{ opportunityId?: string }>).detail;
      if (detail?.opportunityId && detail.opportunityId !== opportunityId) return;
      try {
        await fetch("/api/workflow/opportunities/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId, brandId }),
        });
        router.refresh();
      } catch {
        /* silent */
      }
    }
    async function onDismiss(e: Event) {
      const detail = (e as CustomEvent<{ opportunityId?: string }>).detail;
      if (detail?.opportunityId && detail.opportunityId !== opportunityId) return;
      try {
        await fetch("/api/opportunities/skip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId, brandId }),
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
    window.addEventListener("opportunity:accept", onAccept);
    window.addEventListener("opportunity:dismiss", onDismiss);
    window.addEventListener("opportunity:share", onShare);
    return () => {
      window.removeEventListener("opportunity:accept", onAccept);
      window.removeEventListener("opportunity:dismiss", onDismiss);
      window.removeEventListener("opportunity:share", onShare);
    };
  }, [opportunityId, brandId, router]);

  return null;
}
