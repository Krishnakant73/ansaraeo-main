"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { List, Network } from "lucide-react";

// ============================================================
// RelatedGraph — client-side toggle between the default list view
// and a radial SVG visualization of the related-objects graph.
// Renders in the sidebar next to every workspace. Pure SVG, no
// dep on d3 or react-flow — the graphs are small enough (< 20
// nodes) that a hand-rolled radial layout is faster than a lib.
//
// The list view remains the accessible default (screen readers +
// keyboard navigation get the plain <ul>). The graph is a viz
// enhancement.
// ============================================================

export type RelatedNode = {
  kind: string;
  id: string;
  label: string;
  relation: string;
};

const KIND_COLORS: Record<string, string> = {
  brand: "#6366f1",       // indigo
  prompt: "#06b6d4",      // cyan
  competitor: "#f97316",  // orange
  campaign: "#a855f7",    // purple
  mission: "#8b5cf6",     // violet
  sprint: "#f59e0b",      // amber
  engine: "#0ea5e9",      // sky
  content: "#ec4899",     // pink
  opportunity: "#eab308", // yellow
  automation: "#10b981",  // emerald
  alert: "#ef4444",       // red
  share: "#64748b",       // slate
  task: "#7c3aed",        // violet-600
  team: "#0891b2",        // cyan-600
  playbook: "#c026d3",    // fuchsia
};

function colorForKind(kind: string): string {
  return KIND_COLORS[kind] ?? "#64748b";
}

function hrefFor(kind: string, id: string): string {
  return `/dashboard/w/${kind}/${id}`;
}

export default function RelatedGraph({
  nodes,
  centerKind,
  centerLabel,
  title = "Related",
}: {
  nodes: RelatedNode[];
  centerKind: string;
  centerLabel: string;
  title?: string;
}) {
  const [view, setView] = useState<"list" | "graph">("list");

  // Cluster by relation for the list view.
  const byRelation = useMemo(() => {
    const m = new Map<string, RelatedNode[]>();
    for (const n of nodes) {
      const arr = m.get(n.relation) ?? [];
      arr.push(n);
      m.set(n.relation, arr);
    }
    return m;
  }, [nodes]);

  // Radial layout for the graph view. Uniform angular spacing;
  // labels flip side based on which half of the circle they sit on
  // to avoid overlapping the center. Kept 100% deterministic — no
  // Math.random() (would break SSR hydration).
  const layout = useMemo(() => {
    const w = 400;
    const h = 260;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 40;
    const total = Math.max(1, nodes.length);
    const positions = nodes.map((n, i) => {
      // start at -π/2 so first node is at 12 o'clock
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / total;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return { node: n, x, y, angle };
    });
    return { w, h, cx, cy, positions };
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <section aria-label={title} className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted" aria-hidden />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        <div
          role="tablist"
          aria-label="View mode"
          className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
        >
          <button
            role="tab"
            aria-selected={view === "list"}
            onClick={() => setView("list")}
            className={
              view === "list"
                ? "flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-ink shadow-sm"
                : "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted hover:text-ink"
            }
          >
            <List className="h-3 w-3" aria-hidden /> List
          </button>
          <button
            role="tab"
            aria-selected={view === "graph"}
            onClick={() => setView("graph")}
            className={
              view === "graph"
                ? "flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-ink shadow-sm"
                : "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted hover:text-ink"
            }
          >
            <Network className="h-3 w-3" aria-hidden /> Graph
          </button>
        </div>
      </div>

      {view === "list" ? (
        <div className="space-y-3">
          {Array.from(byRelation.entries()).map(([relation, ns]) => (
            <div key={relation}>
              <p className="section-label mb-1.5">{relation.replace(/_/g, " ")}</p>
              <ul className="space-y-1">
                {ns.map((n) => (
                  <li key={`${n.kind}:${n.id}`}>
                    <Link
                      href={hrefFor(n.kind, n.id)}
                      className="flex items-center justify-between rounded-lg px-2 py-1 text-sm text-ink hover:bg-surface"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: colorForKind(n.kind) }}
                          aria-hidden
                        />
                        <span className="truncate">{n.label}</span>
                      </span>
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-muted">
                        {n.kind}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <svg
            viewBox={`0 0 ${layout.w} ${layout.h}`}
            className="w-full"
            role="img"
            aria-label={`Graph of objects related to ${centerLabel}`}
          >
            {/* Spokes */}
            {layout.positions.map((p) => (
              <line
                key={`spoke-${p.node.kind}-${p.node.id}`}
                x1={layout.cx}
                y1={layout.cy}
                x2={p.x}
                y2={p.y}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
            ))}
            {/* Center node */}
            <g>
              <circle
                cx={layout.cx}
                cy={layout.cy}
                r={22}
                fill={colorForKind(centerKind)}
                opacity={0.15}
              />
              <circle
                cx={layout.cx}
                cy={layout.cy}
                r={14}
                fill={colorForKind(centerKind)}
              />
              <text
                x={layout.cx}
                y={layout.cy + 3}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill="#fff"
              >
                {centerKind.slice(0, 3).toUpperCase()}
              </text>
            </g>
            {/* Related nodes */}
            {layout.positions.map((p) => {
              const rightSide = p.x >= layout.cx;
              const labelX = rightSide ? p.x + 12 : p.x - 12;
              const anchor = rightSide ? "start" : "end";
              return (
                <a
                  key={`node-${p.node.kind}-${p.node.id}`}
                  href={hrefFor(p.node.kind, p.node.id)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={8}
                    fill={colorForKind(p.node.kind)}
                    className="transition-opacity hover:opacity-80"
                  />
                  <text
                    x={labelX}
                    y={p.y + 3}
                    textAnchor={anchor}
                    fontSize={10}
                    fill="#0f172a"
                  >
                    {p.node.label.length > 18 ? p.node.label.slice(0, 18) + "…" : p.node.label}
                  </text>
                </a>
              );
            })}
          </svg>
          <p className="mt-2 text-[10px] text-muted">
            {nodes.length} related object{nodes.length === 1 ? "" : "s"} · click any node to jump
          </p>
        </div>
      )}
    </section>
  );
}
