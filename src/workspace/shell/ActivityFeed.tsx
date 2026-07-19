import Link from "next/link";
import { Activity } from "lucide-react";
import type { ActivitySource, ActivityEntry } from "../core";

// ============================================================
// ActivityFeed — realtime-friendly feed of workspace events.
// The server side renders initial entries; a client wrapper can
// upgrade with SSE via the `stream.url` provided by the descriptor.
// Kept intentionally identical in shape to Timeline; the split lets
// each be styled independently later without renaming callers.
// ============================================================

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export default async function ActivityFeed({
  source,
  title = "Activity",
  limit = 12,
}: {
  source: ActivitySource;
  title?: string;
  limit?: number;
}) {
  let entries: ActivityEntry[] = [];
  try {
    entries = await source.entries();
  } catch {
    entries = [];
  }
  const trimmed = entries.slice(0, limit);

  return (
    <section aria-label={title} className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted" aria-hidden />
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      {trimmed.length === 0 ? (
        <p className="text-xs text-muted">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {trimmed.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="text-[11px] text-muted">
                {formatWhen(e.at)} · {e.kind}
              </p>
              {e.href ? (
                <Link href={e.href} className="text-ink hover:underline">
                  {e.message}
                </Link>
              ) : (
                <span className="text-ink">{e.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
