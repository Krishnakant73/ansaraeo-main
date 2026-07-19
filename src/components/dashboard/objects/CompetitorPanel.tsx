"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ArrowUpRight } from "lucide-react";

type CompetitorPanelData = {
  id: string;
  name: string;
  confirmed: boolean;
  source: string;
};

// The "Competitor workspace" — slide-over that opens from a competitor chip
// instead of navigating away. Answers ONE question: how visible is this
// competitor versus my brand, and what's my next move?
export default function CompetitorPanel({
  competitor,
  shareOfVoice,
}: {
  competitor: CompetitorPanelData;
  shareOfVoice?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function respondTo(action: "confirm" | "reject") {
    setBusy(true);
    await fetch(`/api/competitors/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorId: competitor.id }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line p-5">
        <p className="section-label">Competitor workspace</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-ink">{competitor.name}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="chip">{competitor.source === "ai" ? "AI-suggested" : "Manual"}</span>
          <span className={competitor.confirmed ? "chip chip-accent" : "chip border-amber-200 bg-amber-50 text-amber-700"}>
            {competitor.confirmed ? "Tracking" : "Awaiting review"}
          </span>
          {typeof shareOfVoice === "number" && (
            <span className="chip border-line">
              Share of Voice: {shareOfVoice}%
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <p className="section-label">What you can do here</p>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {!competitor.confirmed ? (
              <li>Confirm to start tracking this competitor across every prompt and engine.</li>
            ) : (
              <li>Review this competitor&rsquo;s share of voice versus your brand on the full page.</li>
            )}
            <li>Open the full Competitors page to see the whole battlefield and battlecards.</li>
          </ul>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line p-5">
        <Link
          href={`/dashboard/w/competitor/${competitor.id}/overview`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <div className="flex items-center gap-2">
          {!competitor.confirmed && (
            <button
              onClick={() => respondTo("confirm")}
              disabled={busy}
              className="btn-success !h-10 disabled:opacity-60"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Confirm
            </button>
          )}
          <button
            onClick={() => respondTo("reject")}
            disabled={busy}
            className="btn-ghost !h-10 disabled:opacity-60"
          >
            <X className="mr-1.5 h-3.5 w-3.5" /> {competitor.confirmed ? "Stop tracking" : "Reject"}
          </button>
        </div>
      </footer>
    </div>
  );
}
