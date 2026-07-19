"use client";

import { useState } from "react";
import { Plus, Check, ListChecks, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import type { PromptSuiteResult } from "@/lib/prompt-suite";

const INTENT_LABELS: Record<string, string> = {
  recommend: "Recommendations",
  compare: "Comparisons",
  define: "Definitions",
  tutorial: "Tutorials / How-to",
  alternative: "Alternatives",
};

export default function PromptSuiteClient({ brandId }: { brandId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PromptSuiteResult | null>(null);
  const [error, setError] = useState<string>("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function generate() {
    setLoading(true);
    setError("");
    setAdded(new Set());
    const res = await fetch("/api/prompt-suite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else {
      setError(data.error);
      alert(data.error);
    }
  }

  async function addPrompt(text: string) {
    const res = await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, text }),
    });
    if (res.ok) setAdded((prev) => new Set(prev).add(text));
    else {
      const data = await res.json();
      alert(data.error);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompt Suite"
        subtitle="Generate a matrix of monitoring prompts grouped by intent — phrased for ChatGPT, Perplexity, and Gemini AI Mode. Review each one, then add the ones you want to track."
        actions={
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary !h-10 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Generating…" : "Generate prompt suite"}
          </button>
        }
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading && (
        <div className="card p-6 text-sm text-muted inline-flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Building your prompt matrix…
        </div>
      )}

      {!loading && result && (
        <>
          {result.notes.length > 0 && (
            <div className="card p-6 text-sm text-muted">
              {result.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}

          {result.suites.length === 0 && result.notes.length === 0 && (
            <p className="text-sm text-muted">No prompts were generated. Try again.</p>
          )}

          <div className="space-y-6">
            {result.suites.map((suite) => (
              <section key={suite.intent} className="card p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
                  {INTENT_LABELS[suite.intent] ?? suite.intent}
                </h2>
                <ul className="mt-4 divide-y divide-line">
                  {suite.prompts.map((prompt) => {
                    const isAdded = added.has(prompt);
                    return (
                      <li
                        key={prompt}
                        className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="text-sm text-ink">{prompt}</span>
                        <button
                          onClick={() => addPrompt(prompt)}
                          disabled={isAdded}
                          className="btn-secondary !h-9 inline-flex shrink-0 items-center gap-1.5 text-xs disabled:opacity-60"
                        >
                          {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {isAdded ? "Added" : "Add as tracked prompt"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {!loading && !result && (
        <div className="card p-6 text-sm text-muted">
          Click &ldquo;Generate prompt suite&rdquo; to build a monitoring prompt matrix for this brand.
        </div>
      )}
    </div>
  );
}
