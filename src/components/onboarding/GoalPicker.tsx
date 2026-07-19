"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Target, TrendingUp, Wrench } from "lucide-react";
import type { GoalKey } from "@/lib/copilot-proposals";

// ============================================================
// GoalPicker — three cards, mutually exclusive, one preselected.
//
// Continue is enabled from the start. No "Skip" option — every path
// leads somewhere useful.
// ============================================================

type Goal = {
  key: GoalKey;
  label: string;
  detail: string;
  meta: string;
  icon: React.ReactNode;
};

const GOALS: Goal[] = [
  {
    key: "chatgpt_mentions",
    label: "Get mentioned in ChatGPT",
    detail: "Draft answer-block pages that target the prompts you're missing.",
    meta: "~2 weeks · we'll draft, you fill in facts",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    key: "beat_competitor",
    label: "Beat your top competitor",
    detail: "Track them nightly, alert on gains, counter their new content.",
    meta: "ongoing · Copilot flags every move",
    icon: <Target className="h-5 w-5" />,
  },
  {
    key: "fix_site",
    label: "Fix your site for AI crawlers",
    detail: "llms.txt, JSON-LD, citations, robots — the technical layer.",
    meta: "~1 hour of edits · high leverage",
    icon: <Wrench className="h-5 w-5" />,
  },
];

export function GoalPicker({
  brandId,
  recommended,
  scanId,
}: {
  brandId: string;
  recommended: GoalKey;
  scanId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<GoalKey>(recommended);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordered = useMemo(
    () => GOALS.slice().sort((a, b) => (a.key === recommended ? -1 : b.key === recommended ? 1 : 0)),
    [recommended],
  );

  async function handleContinue() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, goal: selected }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't save goal. Try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/dashboard/welcome/copilot?goal=${selected}${scanId ? `&scan=${scanId}` : ""}`);
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {ordered.map((g) => {
          const isSelected = selected === g.key;
          const isRecommended = g.key === recommended;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setSelected(g.key)}
              aria-pressed={isSelected}
              className={`card group relative flex flex-col p-5 text-left transition-all ${
                isSelected
                  ? "border-accent shadow-lg ring-2 ring-accent/30"
                  : "hover:-translate-y-0.5 hover:border-line/60 hover:shadow-md"
              }`}
            >
              {isRecommended && (
                <span className="absolute right-4 top-4 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Recommended
                </span>
              )}
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                {g.icon}
              </span>
              <p className="mt-4 text-base font-semibold text-ink">{g.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{g.detail}</p>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted">{g.meta}</p>
              {isSelected && (
                <span className="absolute bottom-4 right-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleContinue}
          disabled={submitting}
          className="btn-primary !h-11 !px-6 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
