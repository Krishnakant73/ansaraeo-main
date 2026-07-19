"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { LayoutGrid, ScatterChart as ScatterIcon, Swords, Check } from "lucide-react";

// ============================================================
// PromptDominanceView — client-side of the Prompt Dominance tab.
//
// Two views:
//   • Table (default) — rows sortable by them-only / contested / total,
//     each with an "Attack this" button that POSTs to
//     /api/competitors/attack-prompt and turns into a link to the new
//     opportunity workspace on success.
//   • Scatter — Prompt Gap Explorer: x=total runs, y=them-only.
//     Top-right quadrant = high-volume, high-gap = attack list.
//
// Toggle top-right; local state, URL not touched (single-tab UX).
// ============================================================

type PromptAgg = {
  promptId: string;
  text: string;
  intent: string | null;
  themOnly: number;
  both: number;
  youOnly: number;
  neither: number;
  total: number;
};

export default function PromptDominanceView({
  competitorId,
  competitorName,
  rows,
}: {
  competitorId: string;
  competitorName: string;
  rows: PromptAgg[];
}) {
  const [view, setView] = useState<"table" | "scatter">("table");
  const [onlyGaps, setOnlyGaps] = useState(false);

  const filtered = useMemo(
    () => (onlyGaps ? rows.filter((r) => r.themOnly > 0) : rows),
    [rows, onlyGaps],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={onlyGaps}
              onChange={(e) => setOnlyGaps(e.target.checked)}
              className="accent-current text-accent"
            />
            Only prompts they win
          </label>
          <span className="text-xs text-muted">· {filtered.length} of {rows.length}</span>
        </div>
        <div role="tablist" aria-label="Prompt Dominance view" className="inline-flex rounded-full border border-line bg-white p-0.5">
          <ToggleButton
            active={view === "table"}
            onClick={() => setView("table")}
            icon={LayoutGrid}
            label="Table"
          />
          <ToggleButton
            active={view === "scatter"}
            onClick={() => setView("scatter")}
            icon={ScatterIcon}
            label="Gap Explorer"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">{competitorName} hasn&rsquo;t been mentioned yet.</p>
          <p className="mt-1 text-xs text-muted">Run scans on more prompts to build competitive data.</p>
        </div>
      ) : view === "table" ? (
        <TableView rows={filtered} competitorId={competitorId} competitorName={competitorName} />
      ) : (
        <ScatterView rows={filtered} competitorName={competitorName} />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active ? "bg-accent text-white" : "text-muted hover:text-ink"
      }`}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {label}
    </button>
  );
}

function TableView({
  rows,
  competitorId,
  competitorName,
}: {
  rows: PromptAgg[];
  competitorId: string;
  competitorName: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
            <th className="px-4 py-3 font-semibold">Prompt</th>
            <th className="px-4 py-3 text-right font-semibold text-rose-600">They win</th>
            <th className="px-4 py-3 text-right font-semibold text-muted">Contested</th>
            <th className="px-4 py-3 text-right font-semibold text-emerald-700">You win</th>
            <th className="px-4 py-3 text-right font-semibold">Runs</th>
            <th className="px-4 py-3 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 60).map((a) => (
            <tr key={a.promptId} className="border-b border-line/60 last:border-0 hover:bg-surface">
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/w/prompt/${a.promptId}/overview`}
                  className="line-clamp-2 text-sm text-ink hover:text-accent"
                >
                  {a.text}
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">
                {a.themOnly > 0 ? (
                  <span className="text-rose-600">{a.themOnly}</span>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted">{a.both}</td>
              <td className="px-4 py-3 text-right font-mono text-xs">
                {a.youOnly > 0 ? (
                  <span className="text-emerald-700">{a.youOnly}</span>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted">{a.total}</td>
              <td className="px-4 py-3 text-right">
                <AttackButton
                  competitorId={competitorId}
                  promptId={a.promptId}
                  disabled={a.themOnly === 0}
                  competitorName={competitorName}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttackButton({
  competitorId,
  promptId,
  disabled,
  competitorName,
}: {
  competitorId: string;
  promptId: string;
  disabled: boolean;
  competitorName: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "existed" | "error">("idle");
  const [id, setId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (state === "done" || state === "existed") {
    return (
      <Link
        href={`/dashboard/w/opportunity/${id}/overview`}
        className="btn-xs btn-xs-success inline-flex items-center gap-1"
      >
        <Check aria-hidden className="h-3 w-3" />
        {state === "existed" ? "Already queued" : "Attacked"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            const res = await fetch("/api/competitors/attack-prompt", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ competitorId, promptId }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as { id: string; existed: boolean };
            setId(data.id);
            setState(data.existed ? "existed" : "done");
          } catch {
            setState("error");
            setTimeout(() => setState("idle"), 2500);
          }
        });
      }}
      title={disabled ? `${competitorName} does not win this prompt` : `Queue an opportunity to attack this prompt`}
      className="btn-xs btn-xs-accent inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={`Attack this prompt against ${competitorName}`}
    >
      <Swords aria-hidden className="h-3 w-3" />
      {isPending ? "Queueing…" : state === "error" ? "Retry" : "Attack this"}
    </button>
  );
}

function ScatterView({ rows, competitorName }: { rows: PromptAgg[]; competitorName: string }) {
  const width = 640;
  const height = 320;
  const pad = 32;
  const maxX = Math.max(1, ...rows.map((r) => r.total));
  const maxY = Math.max(1, ...rows.map((r) => r.themOnly));

  const scaleX = (v: number) => pad + (v / maxX) * (width - pad * 2);
  const scaleY = (v: number) => height - pad - (v / maxY) * (height - pad * 2);

  const midX = scaleX(maxX / 2);
  const midY = scaleY(maxY / 2);

  return (
    <figure className="rounded-2xl border border-line bg-white p-4">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <p className="section-label">Prompt Gap Explorer</p>
        <p className="text-[11px] text-muted">Top-right = high volume × high gap = your attack list</p>
      </figcaption>
      <svg
        role="img"
        aria-label={`Scatter plot: prompt volume vs ${competitorName}'s lead. ${rows.length} prompts.`}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
      >
        {/* Quadrant guides */}
        <line x1={midX} y1={pad} x2={midX} y2={height - pad} className="stroke-line" strokeDasharray="2 3" />
        <line x1={pad} y1={midY} x2={width - pad} y2={midY} className="stroke-line" strokeDasharray="2 3" />
        <text x={width - pad} y={pad + 12} textAnchor="end" className="fill-rose-600 text-[10px] font-semibold">
          High volume · high gap
        </text>
        <text x={pad} y={pad + 12} className="fill-muted text-[10px]">
          Low volume · high gap
        </text>
        <text x={pad} y={height - pad + 14} className="fill-muted text-[10px]">
          Low volume · low gap
        </text>
        {/* Axis labels */}
        <text x={width / 2} y={height - 6} textAnchor="middle" className="fill-muted text-[10px]">
          Total runs
        </text>
        <text
          transform={`translate(10, ${height / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-muted text-[10px]"
        >
          They-only runs
        </text>
        {/* Dots */}
        {rows.map((r) => (
          <Link
            key={r.promptId}
            href={`/dashboard/w/prompt/${r.promptId}/overview`}
            aria-label={`${r.text} — ${r.themOnly} of ${r.total} lost to ${competitorName}`}
          >
            <circle
              cx={scaleX(r.total)}
              cy={scaleY(r.themOnly)}
              r={4}
              className={
                r.total >= maxX / 2 && r.themOnly >= maxY / 2
                  ? "fill-rose-500/70 stroke-rose-600 hover:fill-rose-600"
                  : "fill-muted/40 stroke-muted"
              }
            >
              <title>
                {r.text}: {r.themOnly}/{r.total}
              </title>
            </circle>
          </Link>
        ))}
      </svg>
    </figure>
  );
}
