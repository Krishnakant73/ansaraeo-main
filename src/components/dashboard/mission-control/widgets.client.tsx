"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";

// ============================================================
// Client-only widget bits. Kept small — server components own
// the layout, these own the interactions.
// ============================================================

export function RunScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/visibility-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        toast.error(`Scan failed (${res.status})${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
      } else {
        toast.success("Scan started");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={run} disabled={busy} className="btn-primary !h-9 !px-4 !text-sm">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      Run scan
    </button>
  );
}

export function AskCopilotButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("copilot:open"))}
      className="btn-ghost"
    >
      <Bot className="h-3.5 w-3.5" /> Ask Copilot
    </button>
  );
}

export function AcceptMissionButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function accept() {
    if (busy || done) return;
    setBusy(true);
    try {
      const res = await fetch("/api/workflow/opportunities/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: opportunityId }),
      });
      if (!res.ok) {
        toast.error(`Accept failed (${res.status})`);
      } else {
        setDone(true);
        toast.success("Mission created — jumping to tasks");
        router.push("/dashboard/tasks");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={accept} disabled={busy || done} className="btn-primary !h-9 !px-4 !text-sm">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {done ? "Accepted" : "Accept mission"}
    </button>
  );
}

export function SkipMissionButton({
  opportunityId,
  brandId,
}: {
  opportunityId: string;
  brandId?: string;
}) {
  const [skipped, setSkipped] = useState(false);
  const [busy, setBusy] = useState(false);

  async function skip() {
    if (busy || skipped) return;
    setBusy(true);
    // Optimistic: mirror to localStorage for immediate UI and mark
    // skipped locally. The server row is the source of truth across
    // devices; the localStorage cache exists so a stale tab doesn't
    // resurface the same mission before it re-fetches.
    try {
      const key = "aeo.mc.dismissed";
      try {
        const raw = localStorage.getItem(key);
        const cur: string[] = raw ? JSON.parse(raw) : [];
        if (!cur.includes(opportunityId)) {
          localStorage.setItem(key, JSON.stringify([...cur, opportunityId]));
        }
      } catch {
        /* localStorage disabled — the server call still wins */
      }
      setSkipped(true);

      const res = await fetch("/api/opportunities/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, brandId }),
        keepalive: true,
      });
      if (!res.ok) {
        // Server refused — revert visual state so the user can try
        // again (or, at worst, the mission reappears on refresh, which
        // is safer than pretending it was dismissed).
        setSkipped(false);
        toast.error("Couldn't skip — try again");
        return;
      }
      toast.info("Skipped for now");
    } catch {
      setSkipped(false);
      toast.error("Couldn't skip — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={skip} disabled={busy || skipped} className="btn-ghost">
      <X className="h-3.5 w-3.5" /> {skipped ? "Skipped" : "Skip"}
    </button>
  );
}

// ── Quick-actions wiring — listens for the data-attributes emitted by
// widgets.tsx (server) and dispatches the matching client behavior.

export function QuickActionsBridge() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const trigger = target?.closest?.("[data-quick-action]") as HTMLElement | null;
      if (trigger) {
        const action = trigger.dataset.quickAction;
        if (action === "copilot") {
          window.dispatchEvent(new CustomEvent("copilot:open"));
        } else if (action === "run-scan") {
          // Fire-and-forget; a proper implementation would show a toast.
          fetch("/api/visibility-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
            .then((r) => (r.ok ? toast.success("Scan started") : toast.error(`Scan failed (${r.status})`)))
            .catch((err) => toast.error(err instanceof Error ? err.message : "Scan failed"));
        }
      }
      // Copilot seed handoff from Today's Mission
      const seedEl = target?.closest?.("[data-copilot-open]") as HTMLElement | null;
      if (seedEl) {
        const seed = seedEl.getAttribute("data-copilot-seed") || "";
        window.dispatchEvent(new CustomEvent("copilot:open", { detail: { seed } }));
      }
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);
  return null;
}
