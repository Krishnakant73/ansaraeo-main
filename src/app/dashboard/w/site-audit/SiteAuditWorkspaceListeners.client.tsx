"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// SiteAuditWorkspaceListeners — client bridge for the descriptor's
// serializable quick-action events:
//   site-audit:rerun → POST /api/site-audit { brandId }
//   site-audit:share → clipboard.writeText(location.href)
// Audits are immutable, so "re-run" starts a new audit rather than
// mutating this one. After success we navigate to the new audit.
// ============================================================

export default function SiteAuditWorkspaceListeners({
  auditId,
  brandId,
}: {
  auditId: string;
  brandId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    async function onRerun(e: Event) {
      const detail = (e as CustomEvent<{ auditId?: string }>).detail;
      if (detail?.auditId && detail.auditId !== auditId) return;
      try {
        const res = await fetch(`/api/site-audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId }),
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { audit?: { id?: string } };
        if (data.audit?.id) {
          router.push(`/dashboard/w/site-audit/${data.audit.id}/overview`);
        } else {
          router.refresh();
        }
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
    window.addEventListener("site-audit:rerun", onRerun);
    window.addEventListener("site-audit:share", onShare);
    return () => {
      window.removeEventListener("site-audit:rerun", onRerun);
      window.removeEventListener("site-audit:share", onShare);
    };
  }, [auditId, brandId, router]);

  return null;
}
