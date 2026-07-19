"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FeedEntry } from "./widgets";

// ============================================================
// ActivityFeedLive — client wrapper that hydrates the server-rendered
// ActivityFeed list and subscribes to /api/feed/stream for new events.
//
// Server components render initial entries; this component only handles
// the live-append behavior. Keeps the SSE plumbing off the critical
// initial render path.
//
// Reconnect strategy: EventSource auto-reconnects; when the server ends
// a stream with `event: bye` (budget_exhausted), we re-open manually.
// A "budget exhausted" close is normal — Vercel serverless caps at 60s.
// ============================================================

type Props = {
  brandId: string;
  brandSlug: string;
  initialEntries: FeedEntry[];
};

// Re-export icons/labels through props from parent to keep this file
// dep-free; ActivityFeed passes rendering helpers in a real refactor.
// For now we render minimally and rely on parent to swap in richer chrome.

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function ActivityFeedLive({ brandId, brandSlug, initialEntries }: Props) {
  const [entries, setEntries] = useState<FeedEntry[]>(initialEntries);
  const seenIds = useRef<Set<string>>(new Set(initialEntries.map((e) => e.id)));

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      const es = new EventSource(`/api/feed/stream?brandId=${encodeURIComponent(brandId)}`);
      source = es;

      es.addEventListener("feed", (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data);
          const incoming: FeedEntry[] = Array.isArray(data.entries) ? data.entries : [];
          if (incoming.length === 0) return;
          setEntries((prev) => {
            const merged: FeedEntry[] = [];
            for (const e of incoming) {
              if (seenIds.current.has(e.id)) continue;
              seenIds.current.add(e.id);
              merged.push(e);
            }
            if (merged.length === 0) return prev;
            return [...merged, ...prev].slice(0, 30);
          });
        } catch {
          /* malformed frame */
        }
      });

      es.addEventListener("bye", () => {
        es.close();
        // Server closed intentionally (budget/disconnect). Reconnect
        // after a short pause; the poll baseline resets to "now".
        if (!cancelled) retryTimer = setTimeout(connect, 1500);
      });

      es.onerror = () => {
        // Native reconnect handles transient network errors — nothing to
        // do here unless we want to surface a UI. Silent is fine for now.
      };
    }

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [brandId]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="section-label">Live activity</p>
        <Link href={`/dashboard/b/${brandSlug}/history`} className="text-xs font-medium text-accent">
          Full history →
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          No activity yet. Your first scan will land entries here.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm text-ink")}>{e.message}</p>
                {e.detail && <p className="mt-0.5 text-xs text-muted">{e.detail}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                <span className="text-muted">{relativeTime(e.at)}</span>
                {e.href && (
                  <Link href={e.href} className="font-medium text-accent">
                    View →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
