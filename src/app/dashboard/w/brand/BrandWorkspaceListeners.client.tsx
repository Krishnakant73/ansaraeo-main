"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// BrandWorkspaceListeners — bridges the descriptor's quick-action
// events to real endpoints. Wires:
//   brand:run-scan → POST /api/visibility-check for every priority
//                    prompt on the brand (bounded — descriptor
//                    passes brandId, but the scan endpoint expects
//                    a promptId; we fan out to the top 5 priority
//                    prompts client-side so the operator gets
//                    meaningful data without server-side batching).
//   brand:share    → clipboard copy of the current URL
// ============================================================

export default function BrandWorkspaceListeners({ brandId }: { brandId: string }) {
  const router = useRouter();

  useEffect(() => {
    async function onRunScan(e: Event) {
      const detail = (e as CustomEvent<{ brandId?: string }>).detail;
      if (detail?.brandId && detail.brandId !== brandId) return;
      try {
        // Find the top-5 priority prompts, then trigger a scan for each.
        // Server enforces per-prompt scanning via /api/visibility-check.
        const promptsRes = await fetch(`/api/prompts?brandId=${brandId}&priority=1&limit=5`);
        if (!promptsRes.ok) {
          // Endpoint doesn't accept those query params in every deploy —
          // fall back to a single-brand no-op (silent).
          return;
        }
        const promptData = (await promptsRes.json().catch(() => ({}))) as {
          prompts?: { id: string }[];
        };
        const prompts = promptData.prompts ?? [];
        for (const p of prompts.slice(0, 5)) {
          void fetch("/api/visibility-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptId: p.id }),
          });
        }
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
    window.addEventListener("brand:run-scan", onRunScan);
    window.addEventListener("brand:share", onShare);
    return () => {
      window.removeEventListener("brand:run-scan", onRunScan);
      window.removeEventListener("brand:share", onShare);
    };
  }, [brandId, router]);

  return null;
}
