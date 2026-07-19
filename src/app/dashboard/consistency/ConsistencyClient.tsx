"use client";

import { useState } from "react";
import { Activity, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import type { ConsistencyResult } from "@/lib/visibility-consistency";

type PromptOption = { id: string; text: string };

export default function ConsistencyClient({
  brandId,
  prompts,
  engines,
}: {
  brandId: string;
  prompts: PromptOption[];
  engines: string[];
}) {
  const [selectedPromptId, setSelectedPromptId] = useState<string>(prompts[0]?.id ?? "");
  const [freeText, setFreeText] = useState<string>("");
  const [engine, setEngine] = useState<string>(engines[0] ?? "chatgpt");
  const [runs, setRuns] = useState<number>(3);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The prompt we actually send: free-text if provided, else the chosen
  // prompt's text from the dropdown.
  const promptText = freeText.trim() || prompts.find((p) => p.id === selectedPromptId)?.text || "";

  async function handleRun() {
    if (!promptText) {
      alert("Pick a prompt or type one first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/visibility-consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, promptText, engine, runs }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Request failed");
        return;
      }
      setResult(json.result as ConsistencyResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-accent" /> Mention Consistency
          </span>
        }
        subtitle="Re-run one prompt several times on a chosen engine to see how reliably the brand is cited. This is a stability proxy, not a single ranking."
      />

      <div className="card space-y-4 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Prompt</label>
          <select
            className="w-full rounded border border-divide-line bg-surface px-3 py-2 text-sm text-ink"
            value={selectedPromptId}
            onChange={(e) => setSelectedPromptId(e.target.value)}
            disabled={loading || prompts.length === 0}
          >
            {prompts.length === 0 ? (
              <option value="">No prompts yet — type one below</option>
            ) : (
              prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.text}
                </option>
              ))
            )}
          </select>
          <input
            className="mt-2 w-full rounded border border-divide-line bg-surface px-3 py-2 text-sm text-ink"
            placeholder="…or type a custom prompt"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Engine</label>
            <select
              className="w-full rounded border border-divide-line bg-surface px-3 py-2 text-sm text-ink"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              disabled={loading}
            >
              {engines.map((en) => (
                <option key={en} value={en}>
                  {en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Runs ({runs})</label>
            <input
              type="range"
              min={2}
              max={5}
              step={1}
              value={runs}
              onChange={(e) => setRuns(Number(e.target.value))}
              disabled={loading}
              className="w-full"
            />
          </div>
        </div>

        <button className="btn-primary flex items-center gap-2" onClick={handleRun} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loading ? "Running…" : "Run consistency check"}
        </button>
      </div>

      {error && (
        <div className="card border border-red-300 p-4 text-sm text-red-600">{error}</div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="card flex items-center justify-between p-6">
            <div>
              <div className="text-5xl font-bold text-accent">{result.consistencyScore}</div>
              <div className="mt-1 text-sm text-muted">Consistency score (0–100)</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-ink">
                {result.mentionedRuns}/{result.runs} runs mentioned
              </div>
              <div className="text-sm text-muted">
                mention rate {Math.round(result.mentionRate * 100)}%
              </div>
              <div className="text-sm text-muted">engine: {result.engine}</div>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="mb-2 text-sm font-medium text-ink">Per-run results</h2>
            <ul className="divide-y divide-line">
              {result.perRun.map((r) => (
                <li key={r.run} className="py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">Run #{r.run}</span>
                    {r.mentioned ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> mentioned
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <XCircle className="h-3.5 w-3.5" /> not mentioned
                      </span>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-muted">{r.snippet}</pre>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4 text-xs text-muted">
            {result.notes.map((note, i) => (
              <p key={i} className="mb-1">
                {note}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
