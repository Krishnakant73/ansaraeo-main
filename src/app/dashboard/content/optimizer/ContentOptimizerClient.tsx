"use client";

import { useState } from "react";
import { Loader2, Copy, Download, Sparkles, ArrowRight } from "lucide-react";
import type { OptimizerResult } from "@/lib/content-optimizer";

type Props = {
  brandId: string;
  brandName: string;
};

export default function ContentOptimizerClient({ brandId, brandName }: Props) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizerResult | null>(null);

  async function handleOptimize() {
    if (loading) return;
    if (!url.trim() && !text.trim()) {
      alert("Provide a URL or paste content to optimize.");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/content/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          url: url.trim() || undefined,
          text: text.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? `Request failed (${res.status})`);
        return;
      }

      const data = (await res.json()) as { result: OptimizerResult };
      setResult(data.result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard
      ?.writeText(result.rewrittenMarkdown)
      .then(() => alert("Copied to clipboard"))
      .catch(() => alert("Copy failed"));
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result.rewrittenMarkdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `optimized-${brandName.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="card bg-surface p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" /> Content Optimizer
        </h1>
        <p className="text-sm text-muted">
          Rewrite existing content to be more citable by AI answer engines. Optimizing for:{" "}
          <span className="text-accent">{brandName}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-ink mb-1">Source URL (preferred)</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/your-page"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">…or paste content</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste the page text you want to optimize."
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>

        <button
          onClick={handleOptimize}
          disabled={loading}
          className="btn-primary inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Optimizing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Optimize
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="space-y-6 divide-y divide-line">
          {/* Scores */}
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
            <ScoreTile label="Before overall" value={result.scores.before.overall} />
            <ScoreTile label="After overall" value={result.scores.after.overall} highlight />
            <ScoreTile label="GEO (after)" value={result.scores.after.geo} />
            <ScoreTile label="Readability (after)" value={result.scores.after.readability} />
          </div>

          {/* Rank-gain proxy */}
          <div className="pt-4">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                result.rankGainProxy.level === "high"
                  ? "bg-emerald-100 text-emerald-800"
                  : result.rankGainProxy.level === "medium"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Rank-gain proxy: {result.rankGainProxy.level.toUpperCase()}
            </span>
            <p className="mt-1 text-xs text-muted">{result.rankGainProxy.note}</p>
          </div>

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="pt-4">
              <h2 className="text-sm font-semibold text-ink mb-2">Suggestions</h2>
              <ul className="space-y-2">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-ink font-medium">• {s.issue}</span>
                    <span className="block text-muted">{s.fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rewritten markdown */}
          <div className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink flex items-center gap-1">
                Optimized draft <ArrowRight className="h-3 w-3 text-accent" />
              </h2>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="btn-secondary inline-flex items-center gap-1 text-xs">
                  <Copy className="h-3 w-3" /> Copy
                </button>
                <button onClick={handleDownload} className="btn-secondary inline-flex items-center gap-1 text-xs">
                  <Download className="h-3 w-3" /> Download
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap rounded border border-line bg-surface p-4 text-sm text-ink max-h-96 overflow-auto">
              {result.rewrittenMarkdown}
            </pre>
          </div>

          {/* Honesty note */}
          <p className="pt-4 text-xs text-muted">
            Draft only — fill the <span className="text-accent">[ADD ...]</span> placeholders with your
            real facts; rank-gain is a simulation, not a live ranking.
          </p>

          {result.notes.length > 0 && (
            <ul className="pt-2 space-y-1">
              {result.notes.map((n, i) => (
                <li key={i} className="text-xs text-muted">
                  ⚠ {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border border-line p-3 ${
        highlight ? "border-accent bg-accent/5" : "bg-surface"
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold ${highlight ? "text-accent" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
