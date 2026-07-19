"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// MissionWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events:
//   mission:mark-status → PATCH /api/missions/[id] { status }
//   mission:share       → clipboard.writeText(location.href)
// ============================================================

export default function MissionWorkspaceListeners({
  missionId,
}: {
  missionId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onSetStatus(e: Event) {
      const detail = (e as CustomEvent<{ missionId?: string; status?: string }>).detail;
      if (detail?.missionId && detail.missionId !== missionId) return;
      if (!detail?.status) return;
      try {
        await fetch(`/api/missions/${missionId}`, {
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
    window.addEventListener("mission:mark-status", onSetStatus);
    window.addEventListener("mission:share", onShare);
    return () => {
      window.removeEventListener("mission:mark-status", onSetStatus);
      window.removeEventListener("mission:share", onShare);
    };
  }, [missionId, router]);

  return null;
}
