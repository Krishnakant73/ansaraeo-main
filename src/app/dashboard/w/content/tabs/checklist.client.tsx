"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, AlertTriangle } from "lucide-react";
import { computeStats, type ContentEeat, type ContentItem } from "@/lib/content-workspace-shared";

// ============================================================
// Content › Checklist (client) — the E-E-A-T gate + approve action.
// Uses /api/content/approve (existing server-side enforcer) which
// blocks approval when placeholders remain OR any checkbox is
// unchecked. Never bypass — the API is the truth.
// ============================================================

const ITEMS: { key: keyof ContentEeat; label: string; hint: string }[] = [
  {
    key: "has_named_author",
    label: "Named author",
    hint: "Byline points at a real person. Not a role, not the brand — a name AI engines can attribute.",
  },
  {
    key: "has_original_data_point",
    label: "Original data point",
    hint: "One number, chart, or observation you produced. Not restated from another site.",
  },
  {
    key: "has_first_hand_detail",
    label: "First-hand detail",
    hint: "A specific experience or fact only the operator would know. Grounds the claim.",
  },
];

export default function ChecklistClient({ item }: { item: ContentItem }) {
  const router = useRouter();
  const [checks, setChecks] = useState<ContentEeat>(item.eeat_checklist);
  const [approving, setApproving] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const stats = useMemo(
    () => computeStats(item.content_markdown ?? "", checks),
    [checks, item.content_markdown],
  );

  const isApproved = item.status === "approved" || item.status === "published";

  const persistCheck = useCallback(
    async (next: ContentEeat) => {
      setChecks(next);
      setSavingCheck(true);
      setError(null);
      try {
        const res = await fetch(`/api/content-items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eeat_checklist: next }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: `Save failed: ${res.status}` }));
          throw new Error(j.error ?? `Save failed: ${res.status}`);
        }
        setOk("Saved.");
        router.refresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setSavingCheck(false);
      }
    },
    [item.id, router],
  );

  const approve = useCallback(async () => {
    setApproving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/content/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: item.id,
          contentMarkdown: item.content_markdown ?? "",
          eeatChecklist: checks,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Approve failed: ${res.status}`);
      setOk("Approved.");
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setApproving(false);
    }
  }, [checks, item.content_markdown, item.id, router]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">E-E-A-T checklist</h2>
        <p className="mt-1 text-sm text-muted">
          Google&rsquo;s E-E-A-T (Experience, Expertise, Authoritativeness, Trust) framework applied
          to AEO drafts. Approval is blocked at the API level until every box is real and every
          <code className="mx-1 rounded bg-surface px-1 text-[11px]">[ADD ...]</code>
          placeholder is replaced.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <ul className="space-y-3">
          {ITEMS.map((it) => {
            const checked = !!checks[it.key];
            return (
              <li key={it.key} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() =>
                    persistCheck({ ...checks, [it.key]: !checked } as ContentEeat)
                  }
                  disabled={savingCheck || isApproved}
                  aria-checked={checked}
                  role="checkbox"
                  className={
                    checked
                      ? "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent text-white"
                      : "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-line bg-white"
                  }
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{it.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{it.hint}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Blockers */}
      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Approval gates</p>
        {stats.approvalBlockers.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700">
            All clear. {isApproved ? "Content is already approved." : "Ready to approve."}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {stats.approvalBlockers.map((b) => (
              <li key={b} className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs">
          {error && <span className="text-rose-600">{error}</span>}
          {ok && !error && <span className="text-emerald-700">{ok}</span>}
        </div>
        <button
          type="button"
          onClick={approve}
          disabled={approving || isApproved || stats.approvalBlockers.length > 0}
          className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {approving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {isApproved ? "Approved" : approving ? "Approving…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
