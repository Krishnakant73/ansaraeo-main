"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDIAN_LANGUAGES, languageName } from "@/lib/languages";
import { INTENTS, intentLabel } from "@/lib/intent";
import { Panel } from "@/components/dashboard/panel";

type Prompt = { id: string; text: string; language: string; intent?: string | null; priority?: boolean };
type EngineResult = { engine: string; success: boolean; brand_mentioned?: boolean; error?: string };

export default function PromptsClient({ brandId, prompts }: { brandId: string; prompts: Prompt[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [intent, setIntent] = useState("");
  const [adding, setAdding] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<EngineResult[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function togglePriority(p: Prompt) {
    setTogglingId(p.id);
    const res = await fetch("/api/prompts/priority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId: p.id, priority: !p.priority }),
    });
    setTogglingId(null);
    if (res.ok) router.refresh();
  }

  async function addPrompt(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const res = await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, text, language, intent: intent || undefined }),
    });
    setAdding(false);
    if (res.ok) {
      setText("");
      setIntent("");
      router.refresh();
    }
  }

  async function runCheck(promptId: string) {
    setRunningId(promptId);
    setResults(null);
    const res = await fetch("/api/visibility-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId }),
    });
    const data = await res.json();
    setRunningId(null);
    if (!res.ok) {
      setResults([{ engine: "all", success: false, error: data.error }]);
      return;
    }
    setResults(data.results as EngineResult[]);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Panel title="Add a prompt" description="Then run a live check across every engine.">
        {results && (
          <div className="mb-4 flex flex-wrap gap-2">
            {results.map((r) => (
              <span
                key={r.engine}
                title={r.error}
                className={
                  r.success
                    ? r.brand_mentioned
                      ? "chip chip-accent"
                      : "chip"
                    : "chip border-rose-200 bg-rose-50 text-rose-600"
                }
              >
                {r.engine}: {r.success ? (r.brand_mentioned ? "mentioned ✓" : "not mentioned") : `failed (${r.error})`}
              </span>
            ))}
          </div>
        )}
        <form onSubmit={addPrompt} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="section-label">New prompt to track</label>
            <input
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-accent"
              placeholder="best face wash for oily skin india"
            />
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {INDIAN_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
            title="Intent (funnel stage)"
          >
            <option value="">Intent: auto</option>
            {INTENTS.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={adding} className="btn-primary !h-11 disabled:opacity-60">
            {adding ? "Adding…" : "Add prompt"}
          </button>
        </form>
      </Panel>

      <Panel
        title="Tracked prompts"
        description={`${prompts.length} prompt${prompts.length === 1 ? "" : "s"}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-1 py-3 font-semibold">Prompt</th>
                <th className="px-1 py-3 font-semibold">Lang</th>
                <th className="px-1 py-3 font-semibold">Intent</th>
                <th className="px-1 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((p) => (
                <tr key={p.id} className="border-b border-line/60 transition-colors hover:bg-surface">
                  <td className="px-1 py-3">{p.text}</td>
                  <td className="px-1 py-3 text-xs font-semibold uppercase text-muted">
                    {languageName(p.language)}
                  </td>
                  <td className="px-1 py-3">
                    <span className="chip">{intentLabel(p.intent)}</span>
                  </td>
                  <td className="px-1 py-3">
                    <button
                      onClick={() => togglePriority(p)}
                      disabled={togglingId === p.id}
                      title="Mark as a money prompt (counts toward shortlist share)"
                      className={
                        p.priority
                          ? "chip chip-accent"
                          : "chip border-line"
                      }
                    >
                      {p.priority ? "★ Priority" : "☆ Priority"}
                    </button>
                  </td>
                  <td className="px-1 py-3 text-right">
                    <button
                      onClick={() => runCheck(p.id)}
                      disabled={runningId === p.id}
                      className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-accent transition hover:border-accent disabled:opacity-60"
                    >
                      {runningId === p.id ? "Running…" : "Run check"}
                    </button>
                  </td>
                </tr>
              ))}
              {prompts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-1 py-10 text-center text-sm text-muted">
                    No prompts yet — add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
