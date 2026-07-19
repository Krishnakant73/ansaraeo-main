"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// TaskWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events:
//   task:mark-status → PATCH /api/tasks/[id] { status }
//   task:mark-type   → PATCH /api/tasks/[id] { type }
//   task:share       → clipboard.writeText(location.href)
// ============================================================

export default function TaskWorkspaceListeners({ taskId }: { taskId: string }) {
  const router = useRouter();

  useEffect(() => {
    async function onSetStatus(e: Event) {
      const detail = (e as CustomEvent<{ taskId?: string; status?: string }>).detail;
      if (detail?.taskId && detail.taskId !== taskId) return;
      if (!detail?.status) return;
      try {
        await fetch(`/api/tasks/${taskId}`, {
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
    window.addEventListener("task:mark-status", onSetStatus);
    window.addEventListener("task:share", onShare);
    return () => {
      window.removeEventListener("task:mark-status", onSetStatus);
      window.removeEventListener("task:share", onShare);
    };
  }, [taskId, router]);

  return null;
}
