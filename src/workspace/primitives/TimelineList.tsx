import Link from "next/link";
import type { ReactNode } from "react";

// ============================================================
// TimelineList — the shared vertical timeline rail used by every
// workspace's Activity tab. Renders a border-l pipe with kind-tinted
// dots, a label + optional detail line, and a right-aligned "time
// ago" chip.
//
// Callers still own the data shaping (fetching + sorting + slicing) —
// this primitive is purely presentational so each tab can decide
// what data to surface without a common query contract.
// ============================================================

export type TimelineListEntry = {
  id: string;
  at: string;                       // ISO
  kind: string;                     // used for dot color + optional filter labels
  label: string;                    // primary display line
  detail?: string;                  // optional secondary line
  href?: string;                    // optional link on the label
};

const DOT_STYLES: Record<string, string> = {
  mission: "absolute -left-1.5 h-3 w-3 rounded-full bg-accent",
  campaign: "absolute -left-1.5 h-3 w-3 rounded-full bg-purple-500",
  sprint: "absolute -left-1.5 h-3 w-3 rounded-full bg-amber-500",
  approval: "absolute -left-1 h-2 w-2 rounded-full bg-amber-500",
  content: "absolute -left-1 h-2 w-2 rounded-full bg-pink-500",
  scan: "absolute -left-1 h-2 w-2 rounded-full bg-sky-500",
  alert: "absolute -left-1 h-2 w-2 rounded-full bg-rose-500",
};

function dotClass(kind: string): string {
  return DOT_STYLES[kind] ?? "absolute -left-1 h-2 w-2 rounded-full bg-muted";
}

// Kept local so callers don't need to import a formatter — activity
// tabs shouldn't have to know about time formatting.
function timeAgo(iso: string): string {
  try {
    const d = new Date(iso).getTime();
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 30) return `${days}d ago`;
    const mo = Math.floor(days / 30);
    return `${mo}mo ago`;
  } catch {
    return iso;
  }
}

export default function TimelineList({
  entries,
  emptyState,
  limit = 80,
}: {
  entries: TimelineListEntry[];
  emptyState?: ReactNode;
  limit?: number;
}) {
  const trimmed = entries.slice(0, limit);
  if (trimmed.length === 0) {
    return (
      emptyState ?? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No activity yet.</p>
        </div>
      )
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-line pl-4">
      {trimmed.map((e) => {
        const primary = (
          <p className="min-w-0 text-sm font-medium text-ink">{e.label}</p>
        );
        return (
          <li key={e.id} className="relative">
            <span className={dotClass(e.kind)} aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {e.href ? (
                  <Link href={e.href} className="hover:underline">
                    {primary}
                  </Link>
                ) : (
                  primary
                )}
                {e.detail && (
                  <p className="mt-0.5 truncate text-xs text-muted">{e.detail}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted">{timeAgo(e.at)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
