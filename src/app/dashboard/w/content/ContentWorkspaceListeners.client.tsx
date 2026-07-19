"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// ContentWorkspaceListeners — bridges the descriptor's serializable
// quick-action events to real endpoints:
//   content:set-status  → PATCH /api/content-items/[id] { status }
//   content:share       → clipboard copy of the current URL
//
// Approval flows through a separate button in the Checklist tab (it
// hits /api/content/approve directly so the server-side E-E-A-T
// enforcement runs). We deliberately do NOT let the descriptor
// approve — the checklist gate must be visible and interactive.
// ============================================================

export default function ContentWorkspaceListeners({
  contentId,
}: {
  contentId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onSetStatus(e: Event) {
      const detail = (e as CustomEvent<{ contentId?: string; status?: string }>).detail;
      if (detail?.contentId && detail.contentId !== contentId) return;
      if (!detail?.status) return;
      try {
        await fetch(`/api/content-items/${contentId}`, {
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
    window.addEventListener("content:set-status", onSetStatus);
    window.addEventListener("content:share", onShare);
    return () => {
      window.removeEventListener("content:set-status", onSetStatus);
      window.removeEventListener("content:share", onShare);
    };
  }, [contentId, router]);

  return null;
}
