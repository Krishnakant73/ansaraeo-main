"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, ArrowUpRight } from "lucide-react";
import { languageName } from "@/lib/languages";
import { intentLabel } from "@/lib/intent";

type EngineResult = { engine: string; success: boolean; brand_mentioned?: boolean; error?: string };

export type PromptPanelData = {
  id: string;
  text: string;
  language: string;
  intent?: string | null;
  priority?: boolean;
};

// The "Prompt workspace" — a slide-over that opens from a prompt row instead of
// navigating away. Answers ONE question: what is this prompt's status and what
// can I do with it right now? Keeps the user in context; a link drops them into
// the full Prompts page for history.
export default function PromptPanel({ prompt }: { prompt: PromptPanelData }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<EngineResult[] | null>(null);
  const [priority, setPriority] = useState(!!prompt.priority);

  async function runCheck() {
    setRunning(true);
    setResults(null);
    const res = await fetch("/api/visibility-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId: prompt.id }),
    });
    const data = await res.json();
    setRunning(false);
    if (!res.ok) {
      setResults([{ engine: "all", success: false, error: data.error }]);
      return;
    }
    setResults(data.results as EngineResult[]);
    router.refresh();
  }

  async function togglePriority() {
    const next = !priority;
    setPriority(next);
    await fetch("/api/prompts/priority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId: prompt.id, priority: next }),
    });
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line p-5">
        <p className="section-label">Prompt workspace</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-ink">{prompt.text}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="chip">{languageName(prompt.language)}</span>
          <span className="chip">{intentLabel(prompt.intent)}</span>
          <button
            onClick={togglePriority}
            className={priority ? "chip chip-accent" : "chip border-line"}
            title="Counts toward your shortlist share"
          >
            {priority ? "★ Priority" : "☆ Priority"}
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {results && (
          <div>
            <p className="section-label">Latest check</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
                  {r.engine}: {r.success ? (r.brand_mentioned ? "mentioned ✓" : "not mentioned") : "failed"}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="section-label">What you can do here</p>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            <li>Run a live check to see whether AI engines mention this prompt for your brand.</li>
            <li>Flag it as a priority prompt so it counts toward your shortlist share.</li>
            <li>Open the full Prompts page for run history across every engine.</li>
          </ul>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line p-5">
        <Link
          href={`/dashboard/w/prompt/${prompt.id}/overview`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <button onClick={runCheck} disabled={running} className="btn-primary !h-10 disabled:opacity-60">
          <Play className="mr-1.5 h-3.5 w-3.5" />
          {running ? "Running…" : "Run check"}
        </button>
      </footer>
    </div>
  );
}
