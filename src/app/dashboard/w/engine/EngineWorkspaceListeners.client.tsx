"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// EngineWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events. Handles:
//   engine:share       → clipboard copy of the current URL
//   engine:simulate    → navigate to /overview?sim=1 (Battle
//                        Simulator auto-opens via its URL param)
//   engine:compare     → navigate to /behavior#compare
//   engine:strategy    → navigate to /optimization
//
// Keeps the descriptor RSC-serializable while allowing rich actions.
// ============================================================

export default function EngineWorkspaceListeners({
  engineName,
  engineDisplay,
}: {
  engineName: string;
  // Display name is passed as a prop rather than imported so this client
  // file doesn't drag @/lib/engine-workspace (server-only supabase deps)
  // across the client boundary at build time.
  engineDisplay?: string;
}) {
  const router = useRouter();
  const label = `Engine · ${engineDisplay ?? engineName}`;

  useEffect(() => {
    function scoped(e: Event): boolean {
      const detail = (e as CustomEvent<{ engineName?: string }>).detail;
      // Skip if a name is attached and it doesn't match this workspace.
      return !detail?.engineName || detail.engineName === engineName;
    }

    function onShare(e: Event) {
      if (!scoped(e)) return;
      // Delegate to the shared share-link modal at the shell level.
      window.dispatchEvent(
        new CustomEvent("engine:share-link", {
          detail: {
            workspaceKind: "engine",
            workspaceId: engineName,
            label,
          },
        }),
      );
    }
    function onSimulate(e: Event) {
      if (!scoped(e)) return;
      // Battle Simulator lives on the competitor workspace; scope it via
      // ?sim=1 on the current engine overview instead. When we wire an
      // engine-scoped simulator later, this URL is where it opens.
      router.push(`/dashboard/w/engine/${engineName}/overview?sim=1`);
    }
    function onCompare(e: Event) {
      if (!scoped(e)) return;
      router.push(`/dashboard/w/engine/${engineName}/behavior#compare`);
    }
    function onStrategy(e: Event) {
      if (!scoped(e)) return;
      router.push(`/dashboard/w/engine/${engineName}/optimization`);
    }
    function onGoChangeLog(e: Event) {
      if (!scoped(e)) return;
      router.push(`/dashboard/w/engine/${engineName}/model-changes`);
    }

    window.addEventListener("engine:share", onShare);
    window.addEventListener("engine:simulate", onSimulate);
    window.addEventListener("engine:compare", onCompare);
    window.addEventListener("engine:strategy", onStrategy);
    window.addEventListener("engine:go-change-log", onGoChangeLog);
    return () => {
      window.removeEventListener("engine:share", onShare);
      window.removeEventListener("engine:simulate", onSimulate);
      window.removeEventListener("engine:compare", onCompare);
      window.removeEventListener("engine:strategy", onStrategy);
      window.removeEventListener("engine:go-change-log", onGoChangeLog);
    };
  }, [engineName, label, router]);

  return null;
}
