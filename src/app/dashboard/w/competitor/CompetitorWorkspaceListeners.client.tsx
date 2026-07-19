"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// CompetitorWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events. Handles:
//   competitor:confirm   → POST /api/competitors/confirm
//   competitor:reject    → POST /api/competitors/reject
//   competitor:share     → clipboard copy of the current URL
// Keeps the descriptor RSC-serializable while allowing rich actions.
// ============================================================

export default function CompetitorWorkspaceListeners({
  competitorId,
}: {
  competitorId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function post(action: "confirm" | "reject") {
      try {
        await fetch(`/api/competitors/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ competitorId }),
        });
        router.refresh();
      } catch {
        /* silent */
      }
    }
    async function onConfirm(e: Event) {
      const detail = (e as CustomEvent<{ competitorId?: string }>).detail;
      if (detail?.competitorId && detail.competitorId !== competitorId) return;
      await post("confirm");
    }
    async function onReject(e: Event) {
      const detail = (e as CustomEvent<{ competitorId?: string }>).detail;
      if (detail?.competitorId && detail.competitorId !== competitorId) return;
      await post("reject");
    }
    async function onShare() {
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(window.location.href);
      } catch {
        /* silent */
      }
    }
    window.addEventListener("competitor:confirm", onConfirm);
    window.addEventListener("competitor:reject", onReject);
    window.addEventListener("competitor:share", onShare);
    return () => {
      window.removeEventListener("competitor:confirm", onConfirm);
      window.removeEventListener("competitor:reject", onReject);
      window.removeEventListener("competitor:share", onShare);
    };
  }, [competitorId, router]);

  return null;
}
