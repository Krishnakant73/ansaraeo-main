"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// AlertWorkspaceListeners — bridges:
//   alert:toggle → PATCH /api/alerts/rule [id] { is_active }
//   alert:share  → clipboard copy
// ============================================================

export default function AlertWorkspaceListeners({
  alertId,
}: {
  alertId: string;
}) {
  const router = useRouter();
  useEffect(() => {
    async function onToggle(e: Event) {
      const detail = (e as CustomEvent<{ alertId?: string; next?: boolean }>).detail;
      if (detail?.alertId && detail.alertId !== alertId) return;
      if (typeof detail?.next !== "boolean") return;
      try {
        await fetch(`/api/alerts/rule/${alertId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: detail.next }),
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
    window.addEventListener("alert:toggle", onToggle);
    window.addEventListener("alert:share", onShare);
    return () => {
      window.removeEventListener("alert:toggle", onToggle);
      window.removeEventListener("alert:share", onShare);
    };
  }, [alertId, router]);
  return null;
}
