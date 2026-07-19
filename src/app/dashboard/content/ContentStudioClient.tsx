"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

type GapPrompt = { id: string; text: string };
type ContentItem = { id: string; title: string; status: string; created_at: string };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700",
  in_review: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  published: "bg-accent/10 text-accent",
};

// Bounded — matches the enum in validate.ts. "any" means no shape rail.
const TARGET_ENGINES: { value: string; label: string }[] = [
  { value: "any", label: "Any engine" },
  { value: "chatgpt", label: "Tuned for ChatGPT" },
  { value: "perplexity", label: "Tuned for Perplexity" },
  { value: "gemini", label: "Tuned for Gemini" },
  { value: "google_ai_overview", label: "Tuned for AI Overview" },
  { value: "grok", label: "Tuned for Grok" },
  { value: "copilot", label: "Tuned for Copilot" },
];

export default function ContentStudioClient({
  gapPrompts,
  contentItems,
}: {
  gapPrompts: GapPrompt[];
  contentItems: ContentItem[];
}) {
  const router = useRouter();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [targetEngine, setTargetEngine] = useState<string>("any");

  async function generateFor(promptId: string) {
    setGeneratingId(promptId);
    const body: Record<string, string> = { promptId };
    if (targetEngine !== "any") body.targetEngine = targetEngine;
    const res = await fetch("/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setGeneratingId(null);
    if (!res.ok) {
      alert(data.error);
      return;
    }
    router.push(`/dashboard/content/${data.contentItem.id}`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Gaps to fix</h2>
            <p className="mt-1 text-sm text-muted">
              Prompts where your brand is never mentioned — pick one to draft content for.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted">Target engine</span>
            <select
              value={targetEngine}
              onChange={(e) => setTargetEngine(e.target.value)}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Target engine for the draft"
            >
              {TARGET_ENGINES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {targetEngine !== "any" && (
          <p className="mt-2 text-[11px] text-muted">
            Draft voice, structure, and citation appetite are tuned to how this engine
            actually quotes content. [ADD …] honesty rules still apply.
          </p>
        )}
        <div className="card mt-4 divide-y divide-line/60">
          {gapPrompts.length === 0 && (
            <p className="p-5 text-sm text-muted">No gaps found yet — run some visibility checks first.</p>
          )}
          {gapPrompts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-4">
              <span className="text-sm">&ldquo;{p.text}&rdquo;</span>
              <button
                onClick={() => generateFor(p.id)}
                disabled={generatingId === p.id}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-accent hover:border-accent disabled:opacity-60"
              >
                {generatingId === p.id ? (
                  "Drafting…"
                ) : (
                  <>
                    <Sparkles className="mr-1 inline h-3 w-3" /> Generate draft
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold tracking-tight">Drafts &amp; content</h2>
        <p className="mt-1 text-sm text-muted">Every AI draft needs your review before it&apos;s marked approved.</p>
        <div className="card mt-4 divide-y divide-line/60">
          {contentItems.length === 0 && <p className="p-5 text-sm text-muted">No content yet.</p>}
          {contentItems.map((c) => (
            <Link key={c.id} href={`/dashboard/content/${c.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-surface/60">
              <span className="text-sm font-medium">{c.title}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${STATUS_STYLES[c.status]}`}>
                {c.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
