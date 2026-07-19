// ============================================================
// Mission Control widgets — the operational command surface.
//
// Server components except where marked "use client". Every widget is
// self-contained and error-boundary friendly so a single widget's data
// failure doesn't collapse the page.
// ============================================================

import Link from "next/link";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Bot, CheckCircle2,
  Clock, FileDown, Play, Sparkles, Swords, Target,
  TrendingDown, TrendingUp, Wand2, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/dashboard/panel";
import { VisibilityArea } from "@/components/dashboard/charts";
import {
  AcceptMissionButton,
  AskCopilotButton,
  RunScanButton,
  SkipMissionButton,
} from "./widgets.client";

// ── 1. Mission Header ───────────────────────────────────────

export function MissionHeader({
  brandName,
  brandSlug,
  industry,
  lastScanAt,
}: {
  brandName: string;
  brandSlug: string;
  industry?: string | null;
  lastScanAt?: string | null;
}) {
  const scanAgo = relativeTime(lastScanAt);
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
            {brandName}
          </h1>
          {industry && (
            <span className="chip">{industry}</span>
          )}
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <Clock className="h-3.5 w-3.5" />
          {scanAgo ? (
            <>Last scan · <span className="text-ink">{scanAgo}</span></>
          ) : (
            "No scan yet — run one to hydrate this workspace"
          )}
        </p>
      </div>
      <MissionHeaderActions brandSlug={brandSlug} />
    </header>
  );
}

function MissionHeaderActions({ brandSlug }: { brandSlug: string }) {
  // Server-render the pills; the Copilot pill dispatches a client event
  // handled by the CopilotDock (also a client component).
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RunScanButton />
      <Link href={`/dashboard/b/${brandSlug}/reports`} className="btn-secondary !h-9 !px-4 !text-sm">
        <FileDown className="h-3.5 w-3.5" /> Generate report
      </Link>
      <AskCopilotButton />
    </div>
  );
}

// ── 2. Executive Summary — 4 KPIs ───────────────────────────

export function ExecutiveRow({
  brandSlug,
  visibilityRate,
  visibilityDelta,
  citationShare,
  shortlistShare,
  aiRevenue,
  revenueConnected,
}: {
  brandSlug: string;
  visibilityRate: number | null;
  visibilityDelta: number | null;
  citationShare: number | null;
  shortlistShare: number | null;
  aiRevenue: number | null;
  revenueConnected: boolean;
}) {
  const base = `/dashboard/b/${brandSlug}`;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <ExecTile
        label="Visibility rate"
        value={pct(visibilityRate)}
        delta={visibilityDelta}
        deltaLabel="vs prev 7d"
        href={`${base}/visibility`}
        accent
      />
      <ExecTile
        label="Citation share"
        value={pct(citationShare)}
        hint="own vs competitor vs 3rd"
        href={`${base}/citations`}
      />
      <ExecTile
        label="Shortlist share"
        value={pct(shortlistShare)}
        hint="on priority prompts"
        href={`${base}/prompts?filter=priority`}
      />
      <ExecTile
        label="AI-driven revenue"
        value={revenueConnected ? formatINR(aiRevenue) : "—"}
        hint={revenueConnected ? "assisted, 30d" : "connect GA4 & Shopify"}
        href={revenueConnected ? `${base}/revenue` : "/dashboard/settings/integrations"}
      />
    </div>
  );
}

function ExecTile({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  href,
  accent,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
  href: string;
  accent?: boolean;
}) {
  const showDelta = typeof delta === "number" && !Number.isNaN(delta);
  const positive = (delta ?? 0) >= 0;
  return (
    <Link
      href={href}
      className={cn(
        "kpi group relative cursor-pointer",
        accent && "ring-1 ring-accent/20",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {/* Affordance visible on hover, touch (via focus-within), and keyboard (via focus-visible).
            Touch users get it on tap; keyboard users get it while the card is focused. */}
        <ArrowUpRight
          aria-hidden
          className="h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:opacity-0"
        />
      </div>
      <div className="kpi-value">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {showDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              positive ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta ?? 0)}pp
          </span>
        )}
        {deltaLabel && showDelta && <span className="text-muted">{deltaLabel}</span>}
        {hint && !showDelta && <span className="text-muted">{hint}</span>}
      </div>
    </Link>
  );
}

// ── 3. Today's Mission ──────────────────────────────────────

export function TodaysMission({
  brandSlug,
  brandId,
  opportunity,
}: {
  brandSlug: string;
  brandId?: string;
  opportunity: {
    id: string;
    type: string;
    title: string;
    priority_score: number | null;
    estimated_impact: Record<string, unknown> | null;
  } | null;
}) {
  if (!opportunity) {
    return (
      <Panel
        title="Today's mission"
        description="No high-priority opportunity right now"
      >
        <div className="flex flex-col items-start gap-3 py-4">
          <p className="text-sm text-muted">
            The nightly scan will surface a fresh one overnight. In the meantime, review your{" "}
            <Link href={`/dashboard/b/${brandSlug}/opportunities`} className="text-accent underline underline-offset-2">
              opportunity queue
            </Link>{" "}
            or explore the{" "}
            <Link href={`/dashboard/b/${brandSlug}/visibility`} className="text-accent underline underline-offset-2">
              visibility trend
            </Link>.
          </p>
        </div>
      </Panel>
    );
  }

  const impact = (opportunity.estimated_impact ?? {}) as Record<string, number | string>;
  const mentions = typeof impact.mentions_per_month === "number" ? impact.mentions_per_month : null;
  const priority = typeof opportunity.priority_score === "number" ? Math.round(opportunity.priority_score * 100) : null;
  const difficulty = difficultyFor(opportunity.type);
  const time = timeEstimateFor(opportunity.type);

  return (
    <Panel
      className="border-accent/20 ring-1 ring-accent/10"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Today's mission
        </span>
      }
      description="The single most valuable thing you could do right now"
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-accent">
              {typeLabel(opportunity.type)}
            </span>
            {priority != null && (
              <span className="chip">priority {priority}</span>
            )}
          </div>
          <p className="mt-3 text-lg font-semibold leading-snug text-ink">
            {opportunity.title}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Impact" value={mentions != null ? `+${mentions} mentions/mo` : "High"} />
          <Fact label="Improvement" value={priority != null ? `~+${Math.round(priority / 10)}pp visibility` : "—"} />
          <Fact label="Difficulty" value={difficulty} />
          <Fact label="Time" value={time} />
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <AcceptMissionButton opportunityId={opportunity.id} />
          <SkipMissionButton opportunityId={opportunity.id} brandId={brandId} />
          <button
            type="button"
            className="btn-ghost"
            data-copilot-seed={`Why is "${opportunity.title}" the top opportunity right now?`}
            data-copilot-open
          >
            <Bot className="h-3.5 w-3.5" /> Ask why this?
          </button>
        </div>
      </div>
    </Panel>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

// ── 5. AI Activity Feed ─────────────────────────────────────

export type FeedEntry = {
  id: string;
  kind:
    | "scan.completed"
    | "citation.added"
    | "citation.lost"
    | "competitor.movement"
    | "alert.fired"
    | "mission.completed"
    | "task.completed";
  message: string;
  detail?: string;
  href?: string;
  at: string; // ISO
};

export function ActivityFeed({ brandSlug, entries }: { brandSlug: string; entries: FeedEntry[] }) {
  return (
    <Panel
      title="Activity"
      description="Everything the platform observed since your last visit"
      action={
        <Link href={`/dashboard/b/${brandSlug}/history`} className="text-xs font-medium text-accent">
          Full history →
        </Link>
      }
    >
      {entries.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          No activity yet. Your first scan will land entries here.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => {
            const { Icon, tone } = feedIcon(e.kind);
            return (
              <li key={e.id} className="flex items-start gap-3 py-3">
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", tone)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{e.message}</p>
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
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ── 6. Competitor Radar ─────────────────────────────────────

export type RadarRow = {
  competitor: string;
  deltaPp: number; // percentage-point change vs prior 7d
  onPrompt?: string;
  reason?: string;
};

export function CompetitorRadar({ brandSlug, rows }: { brandSlug: string; rows: RadarRow[] }) {
  return (
    <Panel
      title="Competitor radar"
      description="Biggest movements this week"
      action={
        <Link href={`/dashboard/b/${brandSlug}/competitors`} className="text-xs font-medium text-accent">
          All competitors →
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          Add competitors to start tracking movements. <Link href={`/dashboard/b/${brandSlug}/competitors`} className="text-accent underline">Add one →</Link>
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const positive = r.deltaPp >= 0;
            return (
              <li key={r.competitor} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{r.competitor}</p>
                  {r.onPrompt && <p className="truncate text-xs text-muted">on "{r.onPrompt}"</p>}
                  {r.reason && <p className="mt-0.5 truncate text-xs text-muted">{r.reason}</p>}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    positive ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600",
                  )}
                >
                  {positive ? "+" : ""}
                  {r.deltaPp}pp
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ── 8. Recent Wins ──────────────────────────────────────────

export function RecentWins({ wins }: { wins: { id: string; title: string; result: string; at: string }[] }) {
  if (wins.length === 0) return null; // Widget hides when nothing to celebrate.
  return (
    <Panel
      title="Recent wins"
      description="Closed missions with measurable outcomes"
    >
      <ul className="space-y-3">
        {wins.map((w) => (
          <li key={w.id} className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{w.title}</p>
              <p className="text-xs text-emerald-600">{w.result}</p>
            </div>
            <span className="shrink-0 text-[11px] text-muted">{relativeTime(w.at)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ── 9. AI Health ────────────────────────────────────────────

export type HealthStatus = "healthy" | "attention" | "critical";

export function AIHealth({
  status,
  message,
  fixHref,
}: {
  status: HealthStatus;
  message: string;
  fixHref?: string;
}) {
  const tone =
    status === "healthy" ? { chip: "bg-emerald-50 text-emerald-700", ring: "ring-emerald-200", label: "Healthy" } :
    status === "attention" ? { chip: "bg-amber-50 text-amber-700", ring: "ring-amber-200", label: "Needs attention" } :
                             { chip: "bg-rose-50 text-rose-700", ring: "ring-rose-200", label: "Critical" };
  return (
    <Panel title="AI health" description="Engines, cron, integrations">
      <div className={cn("flex items-start gap-3 rounded-xl p-3 ring-1", tone.ring)}>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", tone.chip)}>
          {tone.label}
        </span>
        <div className="min-w-0 flex-1 text-sm text-ink">{message}</div>
      </div>
      {status !== "healthy" && fixHref && (
        <div className="mt-3">
          <Link href={fixHref} className="btn-ghost">
            Fix it <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </Panel>
  );
}

// ── 10. Trend visualization ─────────────────────────────────

export function TrendWidget({ brandSlug, data }: { brandSlug: string; data: { date: string; score: number }[] }) {
  return (
    <Panel
      title="Visibility trend"
      description="30-day daily mention rate"
      action={
        <Link href={`/dashboard/b/${brandSlug}/visibility`} className="text-xs font-medium text-accent">
          Full analytics →
        </Link>
      }
    >
      {data.length === 0 ? (
        <p className="py-2 text-sm text-muted">Trend renders after your first scan lands.</p>
      ) : (
        <VisibilityArea data={data} />
      )}
    </Panel>
  );
}

// ── 11. Weekly Progress ─────────────────────────────────────

export function WeeklyProgress({
  missionsDone,
  missionsGoal,
  opportunitiesAccepted,
  opportunitiesSurfaced,
  auditPassing,
  auditTotal,
}: {
  missionsDone: number;
  missionsGoal: number;
  opportunitiesAccepted: number;
  opportunitiesSurfaced: number;
  auditPassing: number;
  auditTotal: number;
}) {
  const missionsPct = missionsGoal > 0 ? Math.min(100, Math.round((missionsDone / missionsGoal) * 100)) : 0;
  const oppsPct = opportunitiesSurfaced > 0 ? Math.min(100, Math.round((opportunitiesAccepted / opportunitiesSurfaced) * 100)) : 0;
  const auditPct = auditTotal > 0 ? Math.round((auditPassing / auditTotal) * 100) : 0;

  return (
    <Panel title="This week" description="Progress against your operating rhythm">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Ring label="Missions" pct={missionsPct} caption={`${missionsDone} / ${missionsGoal || "—"}`} />
        <Ring label="Opps accepted" pct={oppsPct} caption={`${opportunitiesAccepted} / ${opportunitiesSurfaced}`} />
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Audit passing</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{auditPct}%</p>
            <p className="text-xs text-muted">{auditPassing} of {auditTotal || "—"} checks</p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-accent" style={{ width: `${auditPct}%` }} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Ring({ label, pct, caption }: { label: string; pct: number; caption: string }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0 -rotate-90" role="img" aria-label={`${label} ${pct}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="text-accent transition-all"
        />
      </svg>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink">{pct}%</p>
        <p className="text-xs text-muted">{caption}</p>
      </div>
    </div>
  );
}

// ── 12. Quick Actions strip ─────────────────────────────────

export function QuickActions({ brandSlug }: { brandSlug: string }) {
  const base = `/dashboard/b/${brandSlug}`;
  const actions: { label: string; icon: React.ComponentType<{ className?: string }>; onClick?: string; href?: string }[] = [
    { label: "Run scan",         icon: Play,      onClick: "run-scan" },
    { label: "Generate report",  icon: FileDown,  href: `${base}/reports` },
    { label: "Compare",          icon: Swords,    href: `${base}/competitors` },
    { label: "Launch campaign",  icon: Target,    href: `${base}/campaigns` },
    { label: "AI fix",           icon: Wand2,     href: `${base}/opportunities` },
    { label: "Ask Copilot",      icon: Bot,       onClick: "copilot" },
  ];
  return (
    <Panel title="Quick actions" description="Or press ⌘K anywhere to reach any of these">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          if (a.href) {
            return (
              <Link key={a.label} href={a.href} className="btn-ghost">
                <Icon className="h-3.5 w-3.5" /> {a.label}
              </Link>
            );
          }
          const trigger = a.onClick === "copilot" ? "copilot" : "run-scan";
          return (
            <button
              key={a.label}
              type="button"
              data-quick-action={trigger}
              className="btn-ghost"
            >
              <Icon className="h-3.5 w-3.5" /> {a.label}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function pct(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${Math.round(v)}%`;
}

function formatINR(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    citation_gap: "Citation gap",
    position_gap: "Position gap",
    competitor_exposure: "Competitor exposure",
    intent_coverage: "Intent coverage",
    schema_missing: "Schema missing",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function difficultyFor(type: string): "Easy" | "Medium" | "Hard" {
  if (type === "citation_gap" || type === "schema_missing") return "Easy";
  if (type === "position_gap" || type === "intent_coverage") return "Medium";
  return "Hard";
}

function timeEstimateFor(type: string): string {
  if (type === "schema_missing") return "~10 min";
  if (type === "citation_gap") return "~30 min";
  if (type === "position_gap") return "~1 hr";
  if (type === "intent_coverage") return "~2 hr";
  return "~1 hr";
}

function feedIcon(kind: FeedEntry["kind"]): { Icon: React.ComponentType<{ className?: string }>; tone: string } {
  switch (kind) {
    case "scan.completed":
      return { Icon: Zap, tone: "bg-accent/10 text-accent" };
    case "citation.added":
      return { Icon: TrendingUp, tone: "bg-emerald-50 text-emerald-600" };
    case "citation.lost":
      return { Icon: TrendingDown, tone: "bg-rose-50 text-rose-600" };
    case "competitor.movement":
      return { Icon: Swords, tone: "bg-amber-50 text-amber-600" };
    case "alert.fired":
      return { Icon: AlertTriangle, tone: "bg-rose-50 text-rose-600" };
    case "mission.completed":
    case "task.completed":
      return { Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" };
  }
}
