import type { TimelineSource, TimelineEntry } from "../core";
import Link from "next/link";
import { Clock } from "lucide-react";

// ============================================================
// Timeline — chronological log of an object's history.
// Consumes descriptor.timeline(object).entries(). Rendered under
// the main body (below the sidebar in mobile stacked order) as a
// full-width strip. Virtualization is left for a follow-up when a
// real workspace surfaces > 500 entries.
// ============================================================

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export default async function Timeline({
  source,
  title = "Timeline",
  emptyLabel = "No history yet.",
  limit = 30,
}: {
  source: TimelineSource;
  title?: string;
  emptyLabel?: string;
  limit?: number;
}) {
  let entries: TimelineEntry[] = [];
  try {
    entries = await source.entries();
  } catch {
    entries = [];
  }
  const trimmed = entries.slice(0, limit);

  return (
    <section
      aria-label={title}
      className="mt-6 rounded-2xl border border-line bg-white p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted" aria-hidden />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        {entries.length > limit && (
          <span className="text-[11px] text-muted">
            Showing {limit} of {entries.length}
          </span>
        )}
      </div>
      {trimmed.length === 0 ? (
        <p className="text-xs text-muted">{emptyLabel}</p>
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-4">
          {trimmed.map((e) => {
            const body = (
              <div className="text-sm text-ink">
                <span className="font-medium">{e.message}</span>
                {e.actor && <span className="ml-2 text-xs text-muted">by {e.actor}</span>}
              </div>
            );
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent/60" aria-hidden />
                <p className="text-[11px] text-muted">{formatWhen(e.at)} · {e.kind}</p>
                {e.href ? (
                  <Link href={e.href} className="hover:underline">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
