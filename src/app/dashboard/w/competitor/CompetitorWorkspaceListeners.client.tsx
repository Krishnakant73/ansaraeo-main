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
    async function onShare(e: Event) {
      // Match by competitor id if attached — safety-net for multi-workspace
      // tabs (edge case: fast tab-switch mid-dispatch).
      const detail = (e as CustomEvent<{ competitorId?: string; label?: string }>).detail;
      if (detail?.competitorId && detail.competitorId !== competitorId) return;
      // Delegate to the shared share-link modal at the shell level.
      window.dispatchEvent(
        new CustomEvent("competitor:share-link", {
          detail: {
            workspaceKind: "competitor",
            workspaceId: competitorId,
            label: detail?.label ?? "this competitor",
          },
        }),
      );
    }
    function onOpenPrompts() {
      router.push(`/dashboard/w/competitor/${competitorId}/prompts`);
    }
    function onOpenBattlePlan() {
      router.push(`/dashboard/w/competitor/${competitorId}/battle-plan`);
    }
    function onSimulate() {
      // Navigate to Overview (where the Simulator lives) and open it.
      // The Simulator reads a URL param to auto-open.
      router.push(`/dashboard/w/competitor/${competitorId}/overview?sim=1`);
    }
    window.addEventListener("competitor:confirm", onConfirm);
    window.addEventListener("competitor:reject", onReject);
    window.addEventListener("competitor:share", onShare);
    window.addEventListener("competitor:open-prompts", onOpenPrompts);
    window.addEventListener("competitor:open-battle-plan", onOpenBattlePlan);
    window.addEventListener("competitor:simulate", onSimulate);
    return () => {
      window.removeEventListener("competitor:confirm", onConfirm);
      window.removeEventListener("competitor:reject", onReject);
      window.removeEventListener("competitor:share", onShare);
      window.removeEventListener("competitor:open-prompts", onOpenPrompts);
      window.removeEventListener("competitor:open-battle-plan", onOpenBattlePlan);
      window.removeEventListener("competitor:simulate", onSimulate);
    };
  }, [competitorId, router]);

  return null;
}
