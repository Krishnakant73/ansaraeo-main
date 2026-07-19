"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// PlaybookWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events:
//   playbook:toggle → PATCH /api/playbooks/[id] { is_active }
//   playbook:share  → clipboard.writeText(location.href)
// ============================================================

export default function PlaybookWorkspaceListeners({
  playbookId,
}: {
  playbookId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onToggle(e: Event) {
      const detail = (e as CustomEvent<{ playbookId?: string; isActive?: boolean }>).detail;
      if (detail?.playbookId && detail.playbookId !== playbookId) return;
      if (typeof detail?.isActive !== "boolean") return;
      try {
        await fetch(`/api/playbooks/${playbookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: detail.isActive }),
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
    window.addEventListener("playbook:toggle", onToggle);
    window.addEventListener("playbook:share", onShare);
    return () => {
      window.removeEventListener("playbook:toggle", onToggle);
      window.removeEventListener("playbook:share", onShare);
    };
  }, [playbookId, router]);

  return null;
}
