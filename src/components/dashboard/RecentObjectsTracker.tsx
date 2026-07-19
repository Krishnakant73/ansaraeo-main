"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// ============================================================
// RecentObjectsTracker
// Client-only. Watches pathname; when the user lands on a route that
// identifies an object, POST /api/recent-objects/track (fire-and-forget)
// so the ObjectsRail's Recent list is server-backed.
//
// URL shapes we recognize (Phase 3):
//   /dashboard/b/<slug>                      → kind=brand,      ref=<slug>
//   /dashboard/b/<slug>/prompts/<id>         → kind=prompt,     ref=<id>
//   /dashboard/b/<slug>/competitors/<id>     → kind=competitor, ref=<id>
//   /dashboard/b/<slug>/campaigns/<id>       → kind=campaign,   ref=<id>
//   /dashboard/b/<slug>/reports/<id>         → kind=report,     ref=<id>
//   /dashboard/w/<kind>/<slug>[/*]           → kind=<kind>,     ref=<slug>
//
// Everything else is a module page, not an object — skipped.
// ============================================================

type ObjectRef = { kind: string; ref_id: string; label?: string };

function classify(pathname: string): ObjectRef | null {
  if (!pathname) return null;
  const parts = pathname.split("/").filter(Boolean);
  // ["dashboard", "b", slug, ...rest]
  if (parts[0] === "dashboard" && parts[1] === "b" && parts[2]) {
    const slug = parts[2];
    // Object-scoped sub-page: /dashboard/b/<slug>/<module>/<id>
    if (parts[3] && parts[4]) {
      const mod = parts[3];
      const id = parts[4];
      if (mod === "prompts") return { kind: "prompt", ref_id: id };
      if (mod === "competitors") return { kind: "competitor", ref_id: id };
      if (mod === "campaigns") return { kind: "campaign", ref_id: id };
      if (mod === "reports") return { kind: "report", ref_id: id };
    }
    // Bare brand page — /dashboard/b/<slug> or /dashboard/b/<slug>/<module>
    return { kind: "brand", ref_id: slug, label: slug };
  }
  // Future UWE routes: /dashboard/w/<kind>/<slug>/[...]
  if (parts[0] === "dashboard" && parts[1] === "w" && parts[2] && parts[3]) {
    return { kind: parts[2], ref_id: parts[3] };
  }
  return null;
}

export default function RecentObjectsTracker() {
  const pathname = usePathname();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    const obj = classify(pathname ?? "");
    if (!obj) return;
    const key = `${obj.kind}:${obj.ref_id}`;
    if (lastRef.current === key) return;
    lastRef.current = key;
    // Fire and forget — a failed track shouldn't disrupt the UI.
    fetch("/api/recent-objects/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
