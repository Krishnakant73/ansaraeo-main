"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// SprintWorkspaceListeners — client bridge:
//   sprint:mark-status → PATCH /api/sprints/[id] { status }
//   sprint:share       → clipboard.writeText(location.href)
// ============================================================

export default function SprintWorkspaceListeners({
  sprintId,
}: {
  sprintId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onSetStatus(e: Event) {
      const detail = (e as CustomEvent<{ sprintId?: string; status?: string }>).detail;
      if (detail?.sprintId && detail.sprintId !== sprintId) return;
      if (!detail?.status) return;
      try {
        await fetch(`/api/sprints/${sprintId}`, {
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
    window.addEventListener("sprint:mark-status", onSetStatus);
    window.addEventListener("sprint:share", onShare);
    return () => {
      window.removeEventListener("sprint:mark-status", onSetStatus);
      window.removeEventListener("sprint:share", onShare);
    };
  }, [sprintId, router]);

  return null;
}
