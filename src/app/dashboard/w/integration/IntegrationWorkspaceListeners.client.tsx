"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// IntegrationWorkspaceListeners — client bridge for the
// descriptor's serializable quick-action events:
//   integration:mark-status → PATCH /api/integrations/[id] { status }
//   integration:share       → clipboard.writeText(location.href)
// Credentials editing NEVER happens here — reconnect goes through
// the provider's settings page, which handles encryption.
// ============================================================

export default function IntegrationWorkspaceListeners({
  integrationId,
}: {
  integrationId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onSetStatus(e: Event) {
      const detail = (e as CustomEvent<{ integrationId?: string; status?: string }>).detail;
      if (detail?.integrationId && detail.integrationId !== integrationId) return;
      if (!detail?.status) return;
      try {
        await fetch(`/api/integrations/${integrationId}`, {
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
    window.addEventListener("integration:mark-status", onSetStatus);
    window.addEventListener("integration:share", onShare);
    return () => {
      window.removeEventListener("integration:mark-status", onSetStatus);
      window.removeEventListener("integration:share", onShare);
    };
  }, [integrationId, router]);

  return null;
}
