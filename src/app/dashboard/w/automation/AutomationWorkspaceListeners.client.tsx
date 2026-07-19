"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// AutomationWorkspaceListeners — bridges:
//   automation:toggle  → PATCH /api/automations/[id] { is_active }
//   automation:share   → clipboard copy
// ============================================================

export default function AutomationWorkspaceListeners({
  automationId,
}: {
  automationId: string;
}) {
  const router = useRouter();
  useEffect(() => {
    async function onToggle(e: Event) {
      const detail = (e as CustomEvent<{ automationId?: string; next?: boolean }>).detail;
      if (detail?.automationId && detail.automationId !== automationId) return;
      if (typeof detail?.next !== "boolean") return;
      try {
        await fetch(`/api/automations/${automationId}`, {
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
    window.addEventListener("automation:toggle", onToggle);
    window.addEventListener("automation:share", onShare);
    return () => {
      window.removeEventListener("automation:toggle", onToggle);
      window.removeEventListener("automation:share", onShare);
    };
  }, [automationId, router]);
  return null;
}
