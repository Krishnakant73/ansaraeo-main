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

export default function ContentStudioClient({
  gapPrompts,
  contentItems,
}: {
  gapPrompts: GapPrompt[];
  contentItems: ContentItem[];
}) {
  const router = useRouter();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  async function generateFor(promptId: string) {
    setGeneratingId(promptId);
    const res = await fetch("/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId }),
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
        <h2 className="text-lg font-bold tracking-tight">Gaps to fix</h2>
        <p className="mt-1 text-sm text-muted">Prompts where your brand is never mentioned — pick one to draft content for.</p>
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
