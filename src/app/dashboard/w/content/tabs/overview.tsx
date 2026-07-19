import Link from "next/link";
import InsightCard from "@/workspace/primitives/InsightCard";
import { timeAgo, type ContentItem } from "@/lib/content-workspace";

// ============================================================
// Content › Overview — status snapshot, approval readiness, and
// context links. The Draft tab owns the editor; this tab answers
// "what is this content and can it ship?" in 15 seconds.
// ============================================================

export default function OverviewBody({ item }: { item: ContentItem }) {
  const preview = (item.content_markdown ?? "").trim().slice(0, 400);
  const readyToApprove = item.stats.approvalBlockers.length === 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Draft</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">
              {item.title || <span className="italic text-muted">Untitled draft</span>}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {item.target_engine && (
                <span className="chip">Target: {item.target_engine.replace(/_/g, " ")}</span>
              )}
              <span className="chip">
                {item.stats.wordCount} word{item.stats.wordCount === 1 ? "" : "s"}
              </span>
              {item.stats.placeholderCount > 0 && (
                <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                  {item.stats.placeholderCount} placeholder{item.stats.placeholderCount === 1 ? "" : "s"}
                </span>
              )}
              <span className="chip">E-E-A-T {item.stats.eeatChecked}/3</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Created</p>
            <p className="text-sm font-semibold text-ink">{timeAgo(item.created_at)}</p>
          </div>
        </div>
      </section>

      {/* Readiness banner */}
      {item.status === "approved" || item.status === "published" ? (
        <InsightCard
          variant="win"
          title={item.status === "published" ? "Content is published" : "Content is approved"}
          description={
            item.approved_at
              ? `Approved ${timeAgo(item.approved_at)}. It cleared all E-E-A-T checks and every placeholder was replaced.`
              : "Content passed the E-E-A-T and placeholder gates."
          }
        />
      ) : readyToApprove ? (
        <InsightCard
          variant="opportunity"
          title="Ready to approve"
          description="Every E-E-A-T box is ticked and all placeholders are replaced. Move it to in_review or approve directly."
        />
      ) : (
        <InsightCard
          variant="warning"
          title="Not ready to approve yet"
          description={item.stats.approvalBlockers.slice(0, 3).join(" · ")}
          href={`/dashboard/w/content/${item.id}/checklist`}
        />
      )}

      {/* Content preview */}
      {preview ? (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-ink">Preview</h3>
            <Link
              href={`/dashboard/w/content/${item.id}/draft`}
              className="text-xs font-medium text-accent hover:underline"
            >
              Open editor →
            </Link>
          </div>
          <div className="whitespace-pre-wrap rounded-2xl border border-line bg-white p-4 font-mono text-xs leading-relaxed text-ink">
            {highlightPlaceholders(preview)}
            {(item.content_markdown ?? "").length > 400 && <span className="text-muted">…</span>}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No draft body yet.</p>
          <p className="mt-1 text-xs text-muted">
            Use Content Studio&rsquo;s generator to draft one, or paste directly into the Draft tab.
          </p>
        </div>
      )}

      {/* Context strip */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title={`Brand · ${item.brand.name}`}
          description="Open the brand workspace for its content queue and visibility posture."
          href={`/dashboard/w/brand/${item.brand.slug}/overview`}
          meta="Brand"
        />
        {item.prompt && (
          <InsightCard
            variant="info"
            title="Target prompt"
            description={item.prompt.text.length > 100 ? item.prompt.text.slice(0, 100) + "…" : item.prompt.text}
            href={`/dashboard/w/prompt/${item.prompt.id}/overview`}
            meta="Prompt"
          />
        )}
      </div>
    </div>
  );
}

// Client-safe highlight — visually splits `[ADD ...]` markers so an
// operator can see honesty placeholders at a glance. Rendered as text
// nodes only, never dangerouslySetInnerHTML.
function highlightPlaceholders(text: string) {
  const chunks: React.ReactNode[] = [];
  const re = /\[ADD[^\]]*\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null) {
    if (m.index > last) chunks.push(text.slice(last, m.index));
    chunks.push(
      <mark
        key={`p-${m.index}`}
        className="rounded bg-amber-100 px-1 font-semibold text-amber-700"
      >
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) chunks.push(text.slice(last));
  return chunks;
}
