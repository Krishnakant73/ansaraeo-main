"use client";

import { useEffect } from "react";

// ============================================================
// EngineWorkspaceListeners — the engine has no destructive quick
// actions (you can't "delete" a registered engine from the UI), so
// this only handles the share event.
// ============================================================

export default function EngineWorkspaceListeners({
  engineId,
}: {
  engineId: string;
}) {
  useEffect(() => {
    async function onShare() {
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(window.location.href);
      } catch {
        /* silent */
      }
    }
    window.addEventListener("engine:share", onShare);
    return () => {
      window.removeEventListener("engine:share", onShare);
    };
    // engineId included so the effect refreshes if the workspace object identity changes
  }, [engineId]);

  return null;
}
