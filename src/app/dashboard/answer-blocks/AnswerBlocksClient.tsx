"use client";

import { useState } from "react";
import { LayoutList, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import type { AnswerBlocksResult, AnswerBlockFormat } from "@/lib/answer-blocks";

const FORMAT_LABEL: Record<AnswerBlockFormat, string> = {
  paragraph: "Paragraph (BLUF)",
  list: "List",
  table: "Comparison table",
  howto: "HowTo steps",
  faq: "FAQ",
};

function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState("Copy");
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setLabel("Copied!");
          setTimeout(() => setLabel("Copy"), 1500);
        } catch {
          /* clipboard unavailable — ignore */
        }
      }}
      className="btn-secondary !h-8 inline-flex items-center gap-1.5 px-3 text-xs"
    >
      {label}
    </button>
  );
}

export default function AnswerBlocksClient({ brandId }: { brandId: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnswerBlocksResult | null>(null);

  async function generate() {
    if (!question.trim()) {
      setError("Enter a target question.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/answer-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, question }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Answer Block Generator"
        subtitle={<>Turn a target question into quotable answer blocks in five formats — plus a schema.org stub. These are drafts: fill any <code className="text-xs">[ADD …]</code> placeholders with real specifics before publishing.</>}
      />

      <div className="card space-y-4 p-6">
        <div>
          <label className="text-xs font-medium text-muted">Target question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How do I choose a CRM for a small business?"
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary !h-10 inline-flex items-center gap-1.5 disabled:opacity-60">
          <Sparkles className="h-4 w-4" />
          {loading ? "Generating…" : "Generate answer blocks"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {loading && (
        <div className="card p-6 text-sm text-muted inline-flex items-center gap-2">
          <LayoutList className="h-4 w-4" /> Writing answer blocks…
        </div>
      )}

      {!loading && result && (
        <>
          {result.notes.length > 0 && (
            <div className="card p-4 text-sm text-muted">
              {result.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}

          {result.blocks.map((block) => (
            <section key={block.format} className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
                  {FORMAT_LABEL[block.format]}
                </h2>
                <CopyButton text={block.markdown} />
              </div>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs leading-relaxed text-ink">
                {block.markdown}
              </pre>
            </section>
          ))}

          {result.schemaJsonLd && (
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">Schema.org JSON-LD</h2>
                <CopyButton text={result.schemaJsonLd} />
              </div>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs leading-relaxed text-ink">
                {result.schemaJsonLd}
              </pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}
