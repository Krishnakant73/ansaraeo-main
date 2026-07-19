"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Check, Sparkles } from "lucide-react";

type ContentGap = {
  promptId: string;
  promptText: string;
  totalRuns: number;
  brandMissedRuns: number;
  competitorsAhead: string[];
  lossRate: number;
};

type KeywordSuggestion = { prompt: string; rationale: string };

export default function ContentGapsClient({ brandId }: { brandId: string }) {
  const [gaps, setGaps] = useState<ContentGap[]>([]);
  const [gapsLoading, setGapsLoading] = useState(true);
  const [gapsError, setGapsError] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setGapsLoading(true);
      const res = await fetch(`/api/content/gaps?brandId=${brandId}`);
      const data = await res.json();
      setGapsLoading(false);
      if (res.ok) setGaps(data.gaps);
      else setGapsError(data.error);
    })();
  }, [brandId]);

  async function generateDraft(promptId: string) {
    setGenerating(promptId);
    const res = await fetch("/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId }),
    });
    const data = await res.json();
    setGenerating(null);
    if (res.ok) window.location.assign(`/dashboard/content/${data.contentItem.id}`);
    else alert(data.error);
  }

  async function loadSuggestions() {
    setSuggestLoading(true);
    setSuggestError("");
    const res = await fetch("/api/content/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    const data = await res.json();
    setSuggestLoading(false);
    if (res.ok) setSuggestions(data.suggestions);
    else setSuggestError(data.error);
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
    <div className="space-y-8">
      {/* ---------- Gaps ---------- */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Losing to competitors</h2>
        {gapsLoading ? (
          <p className="mt-3 text-sm text-muted">Analyzing your visibility runs…</p>
        ) : gapsError ? (
          <p className="mt-3 text-sm text-red-500">{gapsError}</p>
        ) : gaps.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No competitor-loss gaps found yet. Run visibility checks with confirmed competitors to populate this.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {gaps.map((g) => (
              <div key={g.promptId} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{g.promptText}</p>
                    <p className="mt-1 text-xs text-muted">
                      Lost {g.brandMissedRuns}/{g.totalRuns} runs ({g.lossRate}%)
                      {g.competitorsAhead.length ? ` · ahead of you: ${g.competitorsAhead.join(", ")}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => generateDraft(g.promptId)}
                    disabled={generating === g.promptId}
                    className="btn-secondary !h-9 inline-flex items-center gap-1.5 text-xs disabled:opacity-60"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {generating === g.promptId ? "Drafting…" : "Draft content"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Keyword suggestions ---------- */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">New questions to target</h2>
          <button onClick={loadSuggestions} disabled={suggestLoading} className="btn-secondary !h-9 inline-flex items-center gap-1.5 text-xs disabled:opacity-60">
            <Sparkles className="h-3.5 w-3.5" />
            {suggestLoading ? "Thinking…" : suggestions.length ? "Regenerate" : "Suggest keywords"}
          </button>
        </div>
        {suggestError && <p className="mt-3 text-sm text-red-500">{suggestError}</p>}
        {suggestions.length > 0 && (
          <div className="mt-3 space-y-3">
            {suggestions.map((s, i) => {
              const isAdded = added.has(s.prompt);
              return (
                <div key={i} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{s.prompt}</p>
                      <p className="mt-1 text-xs text-muted">{s.rationale}</p>
                    </div>
                    <button
                      onClick={() => addPrompt(s.prompt)}
                      disabled={isAdded}
                      className="btn-secondary !h-9 inline-flex items-center gap-1.5 text-xs disabled:opacity-60"
                    >
                      {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {isAdded ? "Added" : "Track this"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
