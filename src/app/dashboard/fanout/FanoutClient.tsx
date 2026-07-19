"use client";

import { useState } from "react";
import { Network, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import type { FanoutCoverageResult, CoverageStatus } from "@/lib/fanout-coverage";

const STATUS_ICON: Record<CoverageStatus, React.ReactNode> = {
  answered: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  partial: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  missing: <XCircle className="h-4 w-4 text-red-500" />,
  unknown: <HelpCircle className="h-4 w-4 text-muted" />,
};

const STATUS_LABEL: Record<CoverageStatus, string> = {
  answered: "Answered",
  partial: "Partial",
  missing: "Missing",
  unknown: "Unknown",
};

export default function FanoutClient() {
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FanoutCoverageResult | null>(null);

  async function run() {
    if (!topic.trim()) {
      setError("Enter a topic or question.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/fanout-coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, url: url || undefined, text: text || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Query Fan-Out Coverage"
        subtitle="AI answer engines fan a query out into sub-questions and only cite pages that answer them. Enter a topic to see the fan-out set — add a page URL or paste content to measure how much of it you cover."
      />

      <div className="card space-y-4 p-6">
        <div>
          <label className="text-xs font-medium text-muted">Topic or question</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. best CRM for small businesses in India"
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Page URL to score (optional)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yoursite.com/page"
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">…or paste content (optional)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Paste the page copy here to score coverage without a URL."
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button onClick={run} disabled={loading} className="btn-primary !h-10 inline-flex items-center gap-1.5 disabled:opacity-60">
          <Network className="h-4 w-4" />
          {loading ? "Analysing…" : "Analyse fan-out"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <>
          {result.source.hasContent && (
            <div className="card p-6 text-center">
              <p className="text-xs font-medium text-muted">Coverage</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">{result.coveragePercent}%</p>
              <p className="mt-1 text-xs text-muted">
                of the fan-out sub-questions your content answers (partial counts as half)
              </p>
            </div>
          )}

          {result.notes.length > 0 && (
            <div className="card p-4 text-sm text-muted">
              {result.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}

          {result.questions.length > 0 && (
            <div className="card divide-y divide-line/60">
              {result.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3 p-5">
                  <span className="mt-0.5">{STATUS_ICON[q.status]}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{q.question}</p>
                      <span className="shrink-0 text-xs font-medium text-muted">{STATUS_LABEL[q.status]}</span>
                    </div>
                    {q.evidence && (
                      <p className="mt-1 text-sm text-muted">
                        <span className="font-medium">Evidence:</span> “{q.evidence}”
                      </p>
                    )}
                    {q.status !== "answered" && q.fix && (
                      <p className="mt-1 text-sm font-medium text-accent">Fix: {q.fix}</p>
                    )}
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
