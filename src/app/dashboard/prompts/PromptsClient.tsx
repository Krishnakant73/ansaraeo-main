"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Prompt = { id: string; text: string; language: string };
type EngineResult = { engine: string; success: boolean; brand_mentioned?: boolean; error?: string };

export default function PromptsClient({ brandId, prompts }: { brandId: string; prompts: Prompt[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [adding, setAdding] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<EngineResult[] | null>(null);

  async function addPrompt(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const res = await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, text, language }),
    });
    setAdding(false);
    if (res.ok) {
      setText("");
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
    <div>
      <form onSubmit={addPrompt} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs font-medium text-muted">New prompt to track</label>
          <input
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
            placeholder="best face wash for oily skin india"
          />
        </div>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
        </select>
        <button type="submit" disabled={adding} className="btn-primary !h-11 disabled:opacity-60">
          {adding ? "Adding…" : "Add prompt"}
        </button>
      </form>

      {results && (
        <div className="mt-3 flex flex-wrap gap-2">
          {results.map((r) => (
            <span
              key={r.engine}
              className={
                r.success
                  ? r.brand_mentioned
                    ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"
                    : "rounded-full bg-grid px-3 py-1 text-xs font-semibold text-muted"
                  : "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500"
              }
              title={r.error}
            >
              {r.engine}: {r.success ? (r.brand_mentioned ? "mentioned ✓" : "not mentioned") : `failed (${r.error})`}
            </span>
          ))}
        </div>
      )}

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Prompt</th>
              <th className="px-5 py-3 font-medium">Lang</th>
              <th className="px-5 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id} className="border-t border-line/60">
                <td className="px-5 py-3">{p.text}</td>
                <td className="px-5 py-3 uppercase text-xs font-semibold text-muted">{p.language}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => runCheck(p.id)}
                    disabled={runningId === p.id}
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-accent hover:border-accent disabled:opacity-60"
                  >
                    {runningId === p.id ? "Running all engines…" : "Run check now"}
                  </button>
                </td>
              </tr>
            ))}
            {prompts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-muted">
                  No prompts yet — add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
