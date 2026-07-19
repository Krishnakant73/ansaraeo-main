"use client";

import { useState } from "react";
import { SpellCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import type { GeoLintResult, LintStatus } from "@/lib/geo-linter";

const STATUS_ICON: Record<LintStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
};

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export default function GeoLintClient() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeoLintResult | null>(null);

  async function run() {
    if (!url.trim() && !text.trim()) {
      setError("Enter a URL or paste content to lint.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/geo-lint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url || undefined, text: text || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="GEO Content Linter"
        subtitle="A deterministic, rule-based check of a page or draft for AI-citability signals — BLUF, question headings, evidence density, readability, lists, and structured data. Every verdict is a measurable property (no LLM guessing), so results are reproducible."
      />

      <div className="card space-y-4 p-6">
        <div>
          <label className="text-xs font-medium text-muted">Page URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yoursite.com/page (includes structure rules)"
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">…or paste content</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste markdown or copy to lint text-level rules."
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button onClick={run} disabled={loading} className="btn-primary !h-10 inline-flex items-center gap-1.5 disabled:opacity-60">
          <SpellCheck className="h-4 w-4" />
          {loading ? "Linting…" : "Lint content"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-6 text-center">
              <p className="text-xs font-medium text-muted">GEO Score</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                {result.score}
                <span className="ml-2 align-middle text-lg text-muted">Grade {scoreToGrade(result.score)}</span>
              </p>
            </div>
            <div className="card p-6 text-center">
              <p className="text-xs font-medium text-muted">Word count</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">{result.wordCount}</p>
            </div>
          </div>

          {result.notes.length > 0 && (
            <div className="card p-4 text-sm text-muted">
              {result.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}

          <div className="card divide-y divide-line/60">
            {result.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-3 p-5">
                <span className="mt-0.5">{STATUS_ICON[issue.status]}</span>
                <div className="flex-1">
                  <p className="font-semibold">{issue.rule}</p>
                  <p className="mt-1 text-sm text-muted">{issue.detail}</p>
                  {issue.status !== "pass" && issue.fix && (
                    <p className="mt-1 text-sm font-medium text-accent">Fix: {issue.fix}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
