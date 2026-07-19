"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// TeamWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events:
//   team:rename → PATCH /api/teams/[id] { name }
//   team:share  → clipboard.writeText(location.href)
// ============================================================

export default function TeamWorkspaceListeners({ teamId }: { teamId: string }) {
  const router = useRouter();

  useEffect(() => {
    async function onRename(e: Event) {
      const detail = (e as CustomEvent<{ teamId?: string }>).detail;
      if (detail?.teamId && detail.teamId !== teamId) return;
      const name = window.prompt("New team name:");
      if (!name || !name.trim()) return;
      try {
        await fetch(`/api/teams/${teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
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
    window.addEventListener("team:rename", onRename);
    window.addEventListener("team:share", onShare);
    return () => {
      window.removeEventListener("team:rename", onRename);
      window.removeEventListener("team:share", onShare);
    };
  }, [teamId, router]);

  return null;
}
