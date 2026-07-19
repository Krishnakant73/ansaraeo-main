"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, Kanban } from "lucide-react";

// ============================================================
// BattlePlanBoard — client-side DnD kanban. Native HTML5 drag-and-
// drop (no library). Cards move between Now / Next / Later lanes;
// on drop we POST /api/opportunity-recommendations/[id]/status and
// then router.refresh() so the server truth catches up.
//
// Keyboard equivalents: focus a card, use the arrow-key affordances
// underneath its title (← Now  → Next  → Later) to move without a
// mouse. WCAG 2.1 SC 2.1.1 — every drop action has a keyboard peer.
// ============================================================

type Recommendation = {
  id: string;
  title: string;
  rationale: string | null;
  status: string;
  priority_score: number | null;
  type: string;
};

type LaneKey = "now" | "next" | "later";

const LANE_TO_STATUS: Record<LaneKey, string> = {
  now: "in_progress",
  next: "open",
  later: "snoozed",
};

const LANES: { key: LaneKey; title: string; tone: string }[] = [
  { key: "now", title: "Now", tone: "border-rose-200 bg-rose-50/40" },
  { key: "next", title: "Next", tone: "border-amber-200 bg-amber-50/40" },
  { key: "later", title: "Later", tone: "border-line bg-white/60" },
];

export default function BattlePlanBoard({
  initial,
}: {
  initial: Record<LaneKey, Recommendation[]>;
}) {
  const [lanes, setLanes] = useState<Record<LaneKey, Recommendation[]>>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<LaneKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const move = useCallback(
    (id: string, to: LaneKey) => {
      // Optimistic update.
      let card: Recommendation | null = null;
      const next: Record<LaneKey, Recommendation[]> = {
        now: [...lanes.now],
        next: [...lanes.next],
        later: [...lanes.later],
      };
      for (const k of Object.keys(next) as LaneKey[]) {
        const idx = next[k].findIndex((r) => r.id === id);
        if (idx >= 0) {
          card = next[k][idx];
          next[k].splice(idx, 1);
          break;
        }
      }
      if (!card) return;
      next[to] = [{ ...card, status: LANE_TO_STATUS[to] }, ...next[to]];
      setLanes(next);

      startTransition(async () => {
        try {
          await fetch(`/api/opportunity-recommendations/${id}/status`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: LANE_TO_STATUS[to] }),
          });
          router.refresh();
        } catch {
          // Roll back on failure.
          setLanes(lanes);
        }
      });
    },
    [lanes, router],
  );

  return (
    <div
      aria-busy={isPending}
      className="grid gap-3 lg:grid-cols-3"
      aria-label="Battle Plan kanban board"
    >
      {LANES.map((lane) => (
        <section
          key={lane.key}
          className={`flex flex-col gap-3 rounded-2xl border p-3 transition-colors ${lane.tone} ${
            dropZone === lane.key ? "ring-2 ring-accent" : ""
          }`}
          aria-label={`${lane.title} lane, ${lanes[lane.key].length} cards`}
          onDragOver={(e) => {
            e.preventDefault();
            setDropZone(lane.key);
          }}
          onDragLeave={() => setDropZone((cur) => (cur === lane.key ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            setDropZone(null);
            if (dragId) move(dragId, lane.key);
            setDragId(null);
          }}
        >
          <header className="flex items-center gap-1.5 px-1 text-xs">
            <Flag aria-hidden className="h-3 w-3" />
            <span className="font-semibold uppercase tracking-wider text-ink">{lane.title}</span>
            <span className="text-muted">· {lanes[lane.key].length}</span>
          </header>
          {lanes[lane.key].length === 0 ? (
            <p className="rounded-xl border border-dashed border-line/70 bg-white/40 p-4 text-center text-[11px] text-muted">
              Nothing in this lane
            </p>
          ) : (
            lanes[lane.key].map((r) => (
              <LaneCard
                key={r.id}
                rec={r}
                onDragStart={() => setDragId(r.id)}
                onDragEnd={() => setDragId(null)}
                onMove={(target) => move(r.id, target)}
                currentLane={lane.key}
              />
            ))
          )}
        </section>
      ))}
    </div>
  );
}

function LaneCard({
  rec,
  onDragStart,
  onDragEnd,
  onMove,
  currentLane,
}: {
  rec: Recommendation;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: LaneKey) => void;
  currentLane: LaneKey;
}) {
  const otherLanes = (["now", "next", "later"] as LaneKey[]).filter((k) => k !== currentLane);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="group flex flex-col gap-1.5 rounded-xl border border-line bg-white p-3 shadow-sm transition-colors hover:border-accent/40"
      aria-label={`${rec.title}, currently in ${currentLane} lane, draggable`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/w/opportunity/${rec.id}/overview`}
          className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          {rec.title}
        </Link>
        <Kanban aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-muted" />
      </div>
      {rec.rationale && <p className="line-clamp-2 text-[11px] text-muted">{rec.rationale}</p>}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {rec.priority_score != null && (
          <span className="chip">Priority {Math.round(rec.priority_score)}</span>
        )}
        <span className="chip capitalize">{rec.type.replace(/_/g, " ")}</span>
      </div>
      <nav aria-label="Move card" className="mt-1 flex items-center gap-1.5 text-[10px]">
        <span className="text-muted">Move to:</span>
        {otherLanes.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onMove(k)}
            className="btn-xs btn-xs-ghost capitalize"
            aria-label={`Move ${rec.title} to ${k}`}
          >
            {k}
          </button>
        ))}
      </nav>
    </div>
  );
}
