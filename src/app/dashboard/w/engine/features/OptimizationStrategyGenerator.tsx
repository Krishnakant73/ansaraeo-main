"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, ArrowRight } from "lucide-react";

// ============================================================
// OptimizationStrategyGenerator — client component. Fetches the
// deterministic per-engine recipe from
// /api/v1/engines/[name]/strategy (GET) and lets the user "Add
// all to Battle Plan" — that POSTs the same route, which upserts
// opportunity_recommendations rows keyed by (brand, engine, kind).
//
// Each move card carries impact + rationale so the user knows
// what they're buying.
// ============================================================

type Move = {
  kind: string;
  title: string;
  rationale: string;
  impact: { mentions_per_month: number; visibility_delta: number };
  priority: number;
};

export default function OptimizationStrategyGenerator({
  engineName,
  engineDisplay,
  brandSlug,
}: {
  engineName: string;
  engineDisplay: string;
  brandSlug: string;
}) {
  const [moves, setMoves] = useState<Move[]>([]);
  const [status, setStatus] = useState<"idle" | "loaded" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function load() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/engines/${encodeURIComponent(engineName)}/strategy`);
        if (!res.ok) throw new Error(`Strategy returned ${res.status}`);
        const data = (await res.json()) as { moves: Move[] };
        setMoves(data.moves);
        setStatus("loaded");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate strategy");
      }
    });
  }

  function commit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/engines/${encodeURIComponent(engineName)}/strategy`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(`Commit returned ${res.status}`);
        setStatus("saved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save opportunities");
      }
    });
  }

  return (
    <section aria-label={`Optimization strategy for ${engineDisplay}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="section-label">Optimization Strategy Generator</p>
        <span className="text-[11px] text-muted">Deterministic — direction over precision</span>
      </div>

      {status === "idle" ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-6 text-center">
          <p className="text-sm text-ink">
            Generate a set of engine-specific moves tuned to how {engineDisplay} answers.
          </p>
          <button
            type="button"
            onClick={load}
            disabled={isPending}
            className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Sparkles aria-hidden className="h-4 w-4" />
            {isPending ? "Generating…" : "Generate strategy"}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-xs text-rose-600">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          <ol className="grid gap-3 md:grid-cols-2">
            {moves.map((m, i) => (
              <li key={m.kind} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-muted">Move {i + 1}</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">{m.title}</p>
                  </div>
                  <span className="shrink-0 chip">Priority {m.priority}</span>
                </div>
                <p className="mt-2 text-xs text-ink/80">{m.rationale}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                    +{m.impact.mentions_per_month} mentions/mo
                  </span>
                  <span className="chip">+{m.impact.visibility_delta}pp visibility</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {status === "saved" ? (
              <>
                <span className="inline-flex items-center gap-1.5 chip border-emerald-200 bg-emerald-50 text-emerald-700">
                  <Check aria-hidden className="h-3 w-3" />
                  Added to Battle Plan
                </span>
                <a
                  href={`/dashboard/b/${brandSlug}/opportunities`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                >
                  Open Battle Plan <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </a>
              </>
            ) : (
              <button
                type="button"
                onClick={commit}
                disabled={isPending}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {isPending ? "Adding…" : "Add all to Battle Plan"}
              </button>
            )}
            {error && (
              <p role="alert" className="text-xs text-rose-600">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
