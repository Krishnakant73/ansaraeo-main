"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RefreshCw, ArrowUpRight } from "lucide-react";
import { computeStats, type ContentEeat, type ContentItem } from "@/lib/content-workspace-shared";

// ============================================================
// Content › Draft (client) — the editing surface. Saves title,
// content_markdown, target_engine, and the E-E-A-T checklist via
// PATCH /api/content-items/[id]. Never approves from this tab —
// approval goes through the existing /api/content/approve endpoint
// (owned by the checklist tab).
// ============================================================

const TARGET_ENGINES = [
  { value: "", label: "Any engine" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "perplexity", label: "Perplexity" },
  { value: "gemini", label: "Gemini" },
  { value: "google_ai_overview", label: "Google AI Overview" },
  { value: "grok", label: "Grok" },
  { value: "copilot", label: "Copilot" },
];

export default function DraftClient({ item }: { item: ContentItem }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title ?? "");
  const [body, setBody] = useState(item.content_markdown ?? "");
  const [targetEngine, setTargetEngine] = useState(item.target_engine ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eeat: ContentEeat = item.eeat_checklist;
  const stats = useMemo(() => computeStats(body, eeat), [body, eeat]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/content-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content_markdown: body,
          target_engine: targetEngine || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `Save failed: ${res.status}` }));
        throw new Error(j.error ?? `Save failed: ${res.status}`);
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [body, item.id, router, targetEngine, title]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Draft</h2>
        <p className="mt-1 text-sm text-muted">
          Edit the content body directly. Keep any <code className="rounded bg-surface px-1 text-[11px]">[ADD ...]</code>{" "}
          placeholders unresolved until you have the real facts — the approval gate blocks otherwise.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <label className="section-label" htmlFor="c-title">
          Title
        </label>
        <input
          id="c-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best face wash for oily skin in India"
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <label className="section-label mt-4 block" htmlFor="c-engine">
          Target engine
        </label>
        <select
          id="c-engine"
          value={targetEngine}
          onChange={(e) => setTargetEngine(e.target.value)}
          className="mt-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        >
          {TARGET_ENGINES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="section-label mt-4 block" htmlFor="c-body">
          Body (markdown)
        </label>
        <textarea
          id="c-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          spellCheck
          className="mt-1 w-full rounded-xl border border-line bg-white p-3 font-mono text-xs outline-none focus:border-accent"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip">{stats.wordCount} word{stats.wordCount === 1 ? "" : "s"}</span>
            {stats.placeholderCount > 0 && (
              <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                {stats.placeholderCount} placeholder{stats.placeholderCount === 1 ? "" : "s"}
              </span>
            )}
            <span className="chip">E-E-A-T {stats.eeatChecked}/3</span>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-rose-600">{error}</span>}
            {saved && !error && <span className="text-emerald-700">Saved.</span>}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-sm inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? "Saving…" : "Save draft"}
            </button>
          </div>
        </div>
      </div>

      <a
        href={`/dashboard/content/${item.id}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        Open in classic Content Studio <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}
