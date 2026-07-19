"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Opportunity = {
  id: string;
  type: string;
  title: string;
  estimated_impact: Record<string, unknown> | null;
  priority_score: number | null;
  status: string;
};

const TYPE_LABEL: Record<string, string> = {
  citation_gap: "Citation gap",
  position_gap: "Position gap",
  competitor_exposure: "Competitor exposure",
  intent_coverage: "Intent coverage",
  schema_missing: "Schema missing",
};

export default function OpportunityQueue({ opportunities }: { opportunities: Opportunity[] }) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/workflow/opportunities/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: id }),
      });
      if (res.ok) setAccepted((a) => ({ ...a, [id]: true }));
    } finally {
      setBusy(null);
    }
  }

  if (opportunities.length === 0) {
    return <p className="text-sm text-muted">No open opportunities right now. Run a visibility check to surface new gaps.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {opportunities.map((o) => {
        const done = accepted[o.id] || o.status !== "open";
        const mentions = o.estimated_impact
          ? ((o.estimated_impact as Record<string, number>).mentions_per_month ?? null)
          : null;
        return (
          <li key={o.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {TYPE_LABEL[o.type] ?? o.type}
                </span>
                {typeof o.priority_score === "number" && (
                  <span className="text-xs text-muted">priority {Math.round(o.priority_score * 100)}</span>
                )}
              </div>
              <p className="mt-1 truncate text-sm font-medium text-ink">{o.title}</p>
              {typeof mentions === "number" && (
                <p className="text-xs text-muted">~{mentions} est. mentions / month</p>
              )}
            </div>
            <button
              type="button"
              disabled={done || busy === o.id}
              onClick={() => accept(o.id)}
              className={cn(
                "shrink-0",
                done ? "btn-ghost" : "btn-sm",
              )}
            >
              {busy === o.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : done ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Accepted
                </>
              ) : (
                "Accept → Mission"
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
