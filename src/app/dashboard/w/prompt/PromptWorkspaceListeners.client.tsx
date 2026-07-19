"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// PromptWorkspaceListeners — the one client mount that translates
// this workspace's serializable quick-action events into real
// side effects (POST to /api/visibility-check, toggle priority,
// share URL). Kept isolated so descriptors stay RSC-serializable.
// ============================================================

export default function PromptWorkspaceListeners({
  promptId,
  currentPriority,
}: {
  promptId: string;
  currentPriority: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onRunScan(e: Event) {
      const detail = (e as CustomEvent<{ promptId?: string }>).detail;
      if (detail?.promptId && detail.promptId !== promptId) return;
      try {
        await fetch("/api/visibility-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId }),
        });
        router.refresh();
      } catch {
        /* toast infra owned elsewhere — silent-fail keeps the workspace calm */
      }
    }
    async function onTogglePriority(e: Event) {
      const detail = (e as CustomEvent<{ promptId?: string; next?: boolean }>).detail;
      if (detail?.promptId && detail.promptId !== promptId) return;
      const next = typeof detail?.next === "boolean" ? detail.next : !currentPriority;
      try {
        await fetch("/api/prompts/priority", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId, priority: next }),
        });
        router.refresh();
      } catch {
        /* silent */
      }
    }
    async function onShare() {
      try {
        const url = window.location.href;
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
        }
      } catch {
        /* silent */
      }
    }
    window.addEventListener("prompt:run-scan", onRunScan);
    window.addEventListener("prompt:toggle-priority", onTogglePriority);
    window.addEventListener("prompt:share", onShare);
    return () => {
      window.removeEventListener("prompt:run-scan", onRunScan);
      window.removeEventListener("prompt:toggle-priority", onTogglePriority);
      window.removeEventListener("prompt:share", onShare);
    };
  }, [promptId, currentPriority, router]);

  return null;
}
