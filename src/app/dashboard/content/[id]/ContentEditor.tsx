"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type ContentItem = {
  id: string;
  title: string;
  content_markdown: string;
  status: string;
  eeat_checklist: {
    has_named_author: boolean;
    has_original_data_point: boolean;
    has_first_hand_detail: boolean;
  };
};

export default function ContentEditor({ item }: { item: ContentItem }) {
  const router = useRouter();
  const [content, setContent] = useState(item.content_markdown);
  const [checklist, setChecklist] = useState(item.eeat_checklist);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPlaceholders = content.includes("[ADD ");
  const allChecked = checklist.has_named_author && checklist.has_original_data_point && checklist.has_first_hand_detail;
  const isApproved = item.status === "approved";

  async function handleApprove() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/content/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: item.id, contentMarkdown: content, eeatChecklist: checklist }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <div>
        {hasPlaceholders && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This draft has <code>[ADD ...]</code> placeholders — replace them with real specifics before you can
              approve it. This is intentional: the AI won&apos;t invent facts on your behalf.
            </span>
          </div>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isApproved}
          rows={24}
          className="w-full rounded-2xl border border-line p-5 font-mono text-sm leading-relaxed outline-none focus:border-accent disabled:bg-surface"
        />
      </div>

      <div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
          <p className="mt-1 font-bold capitalize">{item.status}</p>
        </div>

        <div className="card mt-4 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">E-E-A-T checklist</p>
          <p className="mt-1 text-xs text-muted">Required before approval — this is what keeps AI-assisted content safe from Google&apos;s scaled-content penalties.</p>
          <div className="mt-4 space-y-3">
            {[
              { key: "has_named_author" as const, label: "Added a real author name/credentials" },
              { key: "has_original_data_point" as const, label: "Added an original data point specific to us" },
              { key: "has_first_hand_detail" as const, label: "Added a real, first-hand example" },
            ].map((item2) => (
              <label key={item2.key} className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={checklist[item2.key]}
                  disabled={isApproved}
                  onChange={(e) => setChecklist({ ...checklist, [item2.key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-[#D66A38]"
                />
                {item2.label}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        {isApproved ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Approved — ready to publish manually or via an integration.
          </p>
        ) : (
          <button
            onClick={handleApprove}
            disabled={saving || !allChecked || hasPlaceholders}
            className="btn-primary mt-4 w-full disabled:opacity-50"
          >
            {saving ? "Approving…" : "Approve content"}
          </button>
        )}
      </div>
    </div>
  );
}
