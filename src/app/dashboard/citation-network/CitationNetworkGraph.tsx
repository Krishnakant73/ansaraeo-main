"use client";

import { useMemo, useState } from "react";

type SourceType = "own" | "competitor" | "third";
type NetNode = {
  id: string;
  label: string;
  kind: "brand" | "prompt" | "source";
  sourceType?: SourceType;
  reach?: number;
};
type NetEdge = { from: string; to: string; engine: string; sourceType: SourceType };

const COLORS: Record<string, string> = {
  brand: "#d66a38",
  prompt: "#475569",
  own: "#10b981",
  competitor: "#ef4444",
  third: "#94a3b8",
};

const W = 840;
const H = 580;
const CX = W / 2;
const CY = H / 2;
const R1 = 150; // prompt ring
const R2 = 260; // source ring

export default function CitationNetworkGraph({
  nodes,
  edges,
  brandName,
}: {
  nodes: NetNode[];
  edges: NetEdge[];
  brandName: string;
}) {
  const [engineFilter, setEngineFilter] = useState<string | null>(null);

  const engines = useMemo(
    () => Array.from(new Set(edges.map((e) => e.engine))).sort(),
    [edges]
  );

  // Deterministic radial layout (no randomness): brand at center, prompts in an
  // inner ring, sources in an outer ring. Sources are sorted by reach so hubs
  // spread evenly rather than clustering.
  const positions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    const brand = nodes.find((n) => n.kind === "brand");
    if (brand) pos.set(brand.id, { x: CX, y: CY });

    const prompts = nodes.filter((n) => n.kind === "prompt");
    prompts.forEach((p, i) => {
      const a = -Math.PI / 2 + (i / Math.max(prompts.length, 1)) * Math.PI * 2;
      pos.set(p.id, { x: CX + R1 * Math.cos(a), y: CY + R1 * Math.sin(a) });
    });

    const sources = [...nodes.filter((n) => n.kind === "source")].sort(
      (a, b) => (b.reach ?? 0) - (a.reach ?? 0)
    );
    sources.forEach((s, i) => {
      const a = -Math.PI / 2 + (i / Math.max(sources.length, 1)) * Math.PI * 2;
      pos.set(s.id, { x: CX + R2 * Math.cos(a), y: CY + R2 * Math.sin(a) });
    });
    return pos;
  }, [nodes]);

  const visibleEdges = useMemo(
    () => (engineFilter ? edges.filter((e) => e.engine === engineFilter) : edges),
    [edges, engineFilter]
  );

  const stats = useMemo(() => {
    const sources = nodes.filter((n) => n.kind === "source");
    return {
      prompts: nodes.filter((n) => n.kind === "prompt").length,
      sources: sources.length,
      own: edges.filter((e) => e.sourceType === "own").length,
      competitor: edges.filter((e) => e.sourceType === "competitor").length,
      third: edges.filter((e) => e.sourceType === "third").length,
    };
  }, [nodes, edges]);

  const hubs = useMemo(
    () =>
      [...nodes.filter((n) => n.kind === "source")].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0)).slice(0, 10),
    [nodes]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="kpi">
          <p className="kpi-label">Tracked prompts</p>
          <p className="kpi-value">{stats.prompts}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Cited sources</p>
          <p className="kpi-value">{stats.sources}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Your-domain cites</p>
          <p className="kpi-value text-emerald-600">{stats.own}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Third-party cites</p>
          <p className="kpi-value">{stats.third}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="section-label mr-1">Filter by engine</span>
        <button
          onClick={() => setEngineFilter(null)}
          className={engineFilter === null ? "chip chip-accent" : "chip border-line"}
        >
          All
        </button>
        {engines.map((e) => (
          <button
            key={e}
            onClick={() => setEngineFilter(e)}
            className={engineFilter === e ? "chip chip-accent" : "chip border-line"}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
        <div className="card overflow-hidden p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Citation network graph">
            {/* edges */}
            {visibleEdges.map((e, i) => {
              const a = positions.get(e.from);
              const b = positions.get(e.to);
              if (!a || !b) return null;
              const dim = engineFilter && e.engine !== engineFilter;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={COLORS[e.sourceType]}
                  strokeWidth={e.sourceType === "own" ? 1.6 : 1}
                  strokeOpacity={dim ? 0.05 : e.sourceType === "own" ? 0.55 : 0.35}
                />
              );
            })}

            {/* nodes */}
            {nodes.map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              if (n.kind === "brand") {
                return (
                  <g key={n.id}>
                    <circle cx={p.x} cy={p.y} r={22} fill={COLORS.brand} />
                    <text x={p.x} y={p.y + 4} textAnchor="middle" className="fill-white text-[11px] font-bold">
                      You
                    </text>
                    <text x={p.x} y={p.y + 38} textAnchor="middle" className="fill-ink text-[12px] font-semibold">
                      {brandName}
                    </text>
                  </g>
                );
              }
              if (n.kind === "prompt") {
                return (
                  <g key={n.id}>
                    <circle cx={p.x} cy={p.y} r={6} fill={COLORS.prompt} />
                    <text
                      x={p.x}
                      y={p.y - 10}
                      textAnchor="middle"
                      className="fill-muted text-[9px]"
                      style={{ pointerEvents: "none" }}
                    >
                      {n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label}
                    </text>
                  </g>
                );
              }
              // source
              const r = 5 + Math.min((n.reach ?? 1) * 1.5, 12);
              const color = COLORS[n.sourceType ?? "third"];
              return (
                <g key={n.id}>
                  <title>{`${n.label} — cited for ${n.reach} prompt${n.reach === 1 ? "" : "s"} (${n.sourceType})`}</title>
                  <circle cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1} />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <p className="text-sm font-semibold text-ink">Citation hubs</p>
            <p className="mt-1 text-xs text-muted">
              Sources cited across the most of your prompts — highest-leverage outreach targets.
            </p>
            <ul className="mt-4 space-y-2.5">
              {hubs.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLORS[h.sourceType ?? "third"] }}
                    />
                    <span className="truncate" title={h.label}>
                      {h.label}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                    {h.reach} prompt{h.reach === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <p className="text-sm font-semibold text-ink">Legend</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: COLORS.own }} /> Your domain
              </li>
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: COLORS.third }} /> Third-party source
              </li>
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: COLORS.competitor }} /> Competitor domain
              </li>
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: COLORS.brand }} /> Your brand (center)
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted">
              Node size = how many prompts a source is cited for. Edges connect a prompt to every source cited when
              answering it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
