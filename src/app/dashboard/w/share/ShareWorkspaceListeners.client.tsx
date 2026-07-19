"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// ShareWorkspaceListeners — bridges:
//   share:revoke  → PATCH /api/share-view-tokens/[token] { revoked: true }
//   share:copy    → clipboard copy of the /share/report/[token] URL
// ============================================================

export default function ShareWorkspaceListeners({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  useEffect(() => {
    async function onRevoke(e: Event) {
      const detail = (e as CustomEvent<{ token?: string }>).detail;
      if (detail?.token && detail.token !== token) return;
      try {
        await fetch(`/api/share-view-tokens/${token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revoked: true }),
        });
        router.refresh();
      } catch {
        /* silent */
      }
    }
    async function onCopy() {
      try {
        const url = `${window.location.origin}/share/report/${token}`;
        if (navigator.clipboard) await navigator.clipboard.writeText(url);
      } catch {
        /* silent */
      }
    }
    window.addEventListener("share:revoke", onRevoke);
    window.addEventListener("share:copy", onCopy);
    return () => {
      window.removeEventListener("share:revoke", onRevoke);
      window.removeEventListener("share:copy", onCopy);
    };
  }, [token, router]);
  return null;
}
