"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2 } from "lucide-react";

// Client component shown on the dashboard when a brand exists but has no
// visibility_runs yet. Reuses the existing POST /api/visibility-check endpoint
// (no backend changes, no new logic). User-initiated and one-time: kicks off
// runs for the brand's starter prompts so the dashboard populates with real
// data instead of a wall of "—" while they wait for the nightly cron.
export function FirstRunCTA({ promptIds }: { promptIds: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [done, setDone] = useState(0);

  async function runAll() {
    if (promptIds.length === 0 || state === "running") return;
    setState("running");

    // Limited concurrency so we don't hammer the engine APIs or trip the
    // /api/visibility-check rate limiter (30/min/IP).
    const CONCURRENCY = 3;
    let completed = 0;
    for (let i = 0; i < promptIds.length; i += CONCURRENCY) {
      const batch = promptIds.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (id) => {
          const res = await fetch("/api/visibility-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptId: id }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data as { error?: string }).error ?? "Failed to run check");
          }
          completed += 1;
          setDone(completed);
        })
      );
    }

    setState("done");
    router.refresh();
  }

  if (state === "done") return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-ink">Your brand is set up — run your first check</p>
        <p className="mt-1 text-sm text-muted">
          {promptIds.length} starter prompt{promptIds.length === 1 ? "" : "s"} are ready. Run them now to
          populate your dashboard with real visibility data across the AI engines.
        </p>
      </div>
      <button
        type="button"
        onClick={runAll}
        disabled={state === "running"}
        className="btn-primary inline-flex !h-10 shrink-0 !px-5 disabled:opacity-60"
      >
        {state === "running" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Running… {done}/{promptIds.length}
          </>
        ) : (
          <>
            <Play className="h-4 w-4" /> Run first check
          </>
        )}
      </button>
    </div>
  );
}
