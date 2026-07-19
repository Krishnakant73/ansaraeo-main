"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Play, X } from "lucide-react";

// ============================================================
// BattleSimulator — modal-ish overlay that models the outcome of
// a proposed move. Client component; posts to /api/v1/competitors/
// [id]/simulate and renders the returned outcome shape. The
// backend is intentionally deterministic (see the API route) so
// the simulator returns *direction*, never a false-precision
// numeric guarantee — the copy makes that explicit.
// ============================================================

type Move = "comparison-page" | "citation-earn" | "review-cluster" | "faq-page";

const MOVES: { key: Move; label: string; blurb: string }[] = [
  {
    key: "comparison-page",
    label: "Ship a comparison page",
    blurb: "One dedicated page comparing you vs them for the top gap prompt.",
  },
  {
    key: "citation-earn",
    label: "Earn a top-source citation",
    blurb: "Get one high-authority page (trusted host) to cite you.",
  },
  {
    key: "review-cluster",
    label: "Seed a review cluster",
    blurb: "Three coordinated reviews across G2 / Reddit / Trustpilot.",
  },
  {
    key: "faq-page",
    label: "Publish an FAQ page",
    blurb: "Structured Q&A page for the top three gap prompts.",
  },
];

type Outcome = {
  headline: string;
  mentionRateDelta: number;
  citationShareDelta: number;
  timingDays: number;
  counterMove: string;
  postCounterDelta: number;
};

export default function BattleSimulator({
  competitorId,
  competitorName,
}: {
  competitorId: string;
  competitorName: string;
}) {
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState<Move>("comparison-page");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  // Auto-open when ?sim=1 lands (from the palette command).
  useEffect(() => {
    if (searchParams?.get("sim") === "1") setOpen(true);
  }, [searchParams]);

  function simulate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/competitors/${competitorId}/simulate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ move }),
        });
        if (!res.ok) throw new Error(`Simulator returned ${res.status}`);
        const data = (await res.json()) as Outcome;
        setOutcome(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simulation failed");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-sm inline-flex items-center gap-1.5"
      >
        <Play aria-hidden className="h-3.5 w-3.5" />
        Simulate a move
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="battle-simulator-title"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-white shadow-float">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <p id="battle-simulator-title" className="text-sm font-semibold text-ink">
              AI Battle Simulator · vs {competitorName}
            </p>
            <p className="text-[11px] text-muted">
              Modeled outcome — not a guarantee. Direction over precision.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setOutcome(null);
              setError(null);
            }}
            aria-label="Close simulator"
            className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <section>
            <p className="section-label">Your proposed move</p>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Pick a move to simulate</legend>
              {MOVES.map((m) => (
                <label
                  key={m.key}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
                    move === m.key ? "border-accent bg-accent/5" : "border-line hover:border-accent/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="move"
                    value={m.key}
                    checked={move === m.key}
                    onChange={() => setMove(m.key)}
                    className="mt-1 accent-current text-accent"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{m.label}</p>
                    <p className="mt-0.5 text-xs text-muted">{m.blurb}</p>
                  </div>
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              onClick={simulate}
              disabled={isPending}
              className="btn-primary mt-4 w-full disabled:opacity-60"
            >
              {isPending ? "Simulating…" : "Simulate"}
            </button>
            {error && (
              <p role="alert" className="mt-2 text-xs text-rose-600">
                {error}
              </p>
            )}
          </section>

          <section aria-live="polite" className="rounded-xl bg-surface p-4">
            <p className="section-label">Modeled outcome</p>
            {!outcome ? (
              <p className="mt-4 text-sm text-muted">
                Pick a move and click Simulate to see a modeled outcome.
              </p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <p className="font-semibold text-ink">{outcome.headline}</p>
                <ul className="space-y-1.5 text-ink/85">
                  <li>
                    Mention rate: <Delta v={outcome.mentionRateDelta} /> pp
                  </li>
                  <li>
                    Citation share: <Delta v={outcome.citationShareDelta} /> pp
                  </li>
                  <li>Timing: about {outcome.timingDays} days to visible effect.</li>
                </ul>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                  <p className="font-semibold">If they respond</p>
                  <p className="mt-1">{outcome.counterMove}</p>
                  <p className="mt-1">
                    Net delta after counter-move: <Delta v={outcome.postCounterDelta} /> pp
                  </p>
                </div>
                <p className="pt-2 text-[11px] uppercase tracking-wider text-muted">
                  Modeled — not a guarantee
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Delta({ v }: { v: number }) {
  if (v > 0) return <span className="font-mono font-semibold text-emerald-700">+{v.toFixed(1)}</span>;
  if (v < 0) return <span className="font-mono font-semibold text-rose-600">{v.toFixed(1)}</span>;
  return <span className="font-mono font-semibold text-muted">0</span>;
}
