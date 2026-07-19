"use client";

import { useState } from "react";
import { Eye, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import type { BlindDiscoveryResult } from "@/lib/blind-discovery";

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  grok: "Grok",
  copilot: "Copilot",
};

export default function BlindDiscoveryClient({
  brandId,
  brandName,
  engines,
}: {
  brandId: string;
  brandName: string;
  engines: string[];
}) {
  const [question, setQuestion] = useState("");
  const [engine, setEngine] = useState(engines[0] ?? "chatgpt");
  const [runs, setRuns] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BlindDiscoveryResult | null>(null);

  async function run() {
    if (!question.trim()) {
      setError("Enter an unbranded category question.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/blind-discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, question, engine, runs }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blind Discovery"
        subtitle={`Ask an unbranded category question (don't name ${brandName}) and see whether the engine recommends you unprompted — and which competitors it names instead. Recall is a deterministic check, not an LLM self-report.`}
      />

      <div className="card space-y-4 p-6">
        <div>
          <label className="text-xs font-medium text-muted">Unbranded category question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What are the best CRMs for small businesses in India?"
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-xs font-medium text-muted">Engine</label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="mt-1 block rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
            >
              {engines.map((e) => (
                <option key={e} value={e}>
                  {ENGINE_LABEL[e] ?? e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Runs (2–5)</label>
            <select
              value={runs}
              onChange={(e) => setRuns(Number(e.target.value))}
              className="mt-1 block rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary !h-10 inline-flex items-center gap-1.5 disabled:opacity-60">
          <Eye className="h-4 w-4" />
          {loading ? "Probing…" : "Run blind discovery"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <>
          {result.runs > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-6 text-center">
                <p className="text-xs font-medium text-muted">Organic recall</p>
                <p className="mt-1 text-4xl font-extrabold tracking-tight">{result.recallPercent}%</p>
                <p className="mt-1 text-xs text-muted">
                  {brandName} surfaced in {result.brandRecallRuns} of {result.runs} runs on {ENGINE_LABEL[result.engine] ?? result.engine}
                </p>
              </div>
              <div className="card p-6">
                <p className="text-xs font-medium text-muted">Competitors recommended instead</p>
                {result.competitorTally.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {result.competitorTally.map((c) => (
                      <li key={c.name} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted">
                          {c.runs}/{result.runs} runs
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">No tracked competitors surfaced.</p>
                )}
              </div>
            </div>
          )}

          {result.notes.length > 0 && (
            <div className="card p-4 text-sm text-muted">
              {result.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}

          {result.perRun.length > 0 && (
            <div className="card divide-y divide-line/60">
              {result.perRun.map((r) => (
                <div key={r.run} className="flex items-start gap-3 p-5">
                  <span className="mt-0.5">
                    {r.brandFound ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold">
                      Run {r.run} — {r.brandFound ? `${brandName} mentioned` : `${brandName} not mentioned`}
                    </p>
                    {r.competitorsFound.length > 0 && (
                      <p className="mt-1 text-sm text-muted">Competitors seen: {r.competitorsFound.join(", ")}</p>
                    )}
                    <p className="mt-1 text-sm text-muted">{r.error ?? r.snippet}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
