"use client";

import { useEffect, useMemo, useState } from "react";
import {
  History, RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Sparkles, Trash2, Download, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Panel } from "@/components/dashboard/panel";

// ---------- types (mirror the history-engine API responses) ----------
type TrendPoint = { bucket: string; total: number; mentioned: number; rate: number | null };
type Trends = { overall: TrendPoint[]; byEngine: Record<string, TrendPoint[]> };
type Mover = { name: string; delta: number; trend: "gaining" | "losing" | "stable" };
type CompetitorTrend = Record<string, { month: string; mentioned: number; total: number }[]>;
type FirstMention = { engine: string; observed_at: string };
type PromptImprovement = {
  prompt_id: string; prompt_text: string; recentRate: number | null; priorRate: number | null; delta: number | null;
};
type CitationChanges = { gained: number; lost: number; gainedDomains: string[]; lostDomains: string[] };
type AlertRow = {
  id: string; event_id: string; prompt_id: string | null; engine_name: string | null;
  alert_type: string; severity: string; occurred_at: string; detail: any; acknowledged: boolean;
};
type ComparisonResult = {
  windowA: { from: string; to: string; overall: number | null; byEngine: Record<string, number | null> };
  windowB: { from: string; to: string; overall: number | null; byEngine: Record<string, number | null> };
  delta: { overall: number | null; byEngine: Record<string, number | null> };
  citations: { windowA: { gained: number; lost: number }; windowB: { gained: number; lost: number } };
};
type PromptOption = { id: string; text: string };
type PromptObservationRow = {
  observed_at: string; engine_name: string | null; brand_mentioned: boolean | null;
  brand_position: number | null; sentiment: string | null; recommendation_alignment: string | null; skipped: boolean;
};
type EventRow = {
  id: string; prompt_id: string | null; engine_name: string | null; event_type: string;
  occurred_at: string; detail: any; severity: string;
};
type Insights = {
  firstMentionByEngine: FirstMention[];
  competitorTrend: CompetitorTrend;
  competitorMovers: Mover[];
  promptImprovements: PromptImprovement[];
  citationChanges: CitationChanges;
  engineChangeSignals: number;
};

const ENGINE_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#14b8a6", "#ec4899"];

const EVENT_LABELS: Record<string, string> = {
  FIRST_MENTION: "First mention",
  MENTION_GAINED: "Mention gained",
  MENTION_LOST: "Mention lost",
  FIRST_RECOMMENDATION: "First recommendation",
  RECOMMENDATION_GAINED: "Recommendation gained",
  RECOMMENDATION_LOST: "Recommendation lost",
  POSITION_IMPROVED: "Position improved",
  POSITION_DROPPED: "Position dropped",
  SENTIMENT_SHIFTED: "Sentiment shifted",
  CITATION_GAINED: "Citation gained",
  CITATION_LOST: "Citation lost",
  COMPETITOR_GAINED: "Competitor gained",
  COMPETITOR_LOST: "Competitor lost",
  ENGINE_CHANGE_DETECTED: "Engine change detected",
};

const SEVERITY_BADGE: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-600",
  negative: "bg-rose-50 text-rose-600",
  info: "bg-grid text-muted",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "timeline", label: "Timeline" },
  { key: "trends", label: "Trends" },
  { key: "competitors", label: "Competitors" },
  { key: "citations", label: "Citations" },
  { key: "prompts", label: "Prompts" },
  { key: "alerts", label: "Alerts" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
function fmtBucket(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}
function detailText(e: EventRow): string {
  const d = e.detail ?? {};
  if (Array.isArray(d.domains) && d.domains.length) return d.domains.slice(0, 6).join(", ");
  if (Array.isArray(d.competitors) && d.competitors.length) return d.competitors.slice(0, 6).join(", ");
  if (d.from != null && d.to != null) return `${d.from} → ${d.to}`;
  return "";
}

export default function HistoryClient({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [insights, setInsights] = useState<Insights | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [competitors, setCompetitors] = useState<{ trend: CompetitorTrend; movers: Mover[] } | null>(null);
  const [citations, setCitations] = useState<CitationChanges | null>(null);

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [prompts, setPrompts] = useState<PromptOption[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [promptObs, setPromptObs] = useState<PromptObservationRow[]>([]);
  const [promptEvents, setPromptEvents] = useState<EventRow[]>([]);

  const [compareAFrom, setCompareAFrom] = useState("");
  const [compareATo, setCompareATo] = useState("");
  const [compareBFrom, setCompareBFrom] = useState("");
  const [compareBTo, setCompareBTo] = useState("");
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  const [timeline, setTimeline] = useState<EventRow[]>([]);
  const [engineFilter, setEngineFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [tier, setTier] = useState("unlimited");
  const [savingTier, setSavingTier] = useState(false);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  async function loadCore() {
    setLoading(true);
    setError("");
    try {
      const [i, t, c, ci, r, al, pr] = await Promise.all([
        fetch(`/api/history/insights?brandId=${brandId}`).then((x) => x.json()),
        fetch(`/api/history/trends?brandId=${brandId}&bucket=month`).then((x) => x.json()),
        fetch(`/api/history/competitors?brandId=${brandId}`).then((x) => x.json()),
        fetch(`/api/history/citations?brandId=${brandId}`).then((x) => x.json()),
        fetch(`/api/history/retention`).then((x) => x.json()),
        fetch(`/api/history/alerts?limit=50`).then((x) => x.json()),
        fetch(`/api/prompts`).then((x) => x.json()),
      ]);
      setInsights(i.insights ?? null);
      setTrends(t.trends ?? null);
      setCompetitors({ trend: c.trend ?? {}, movers: c.movers ?? [] });
      setCitations(ci.citations ?? null);
      setTier(r.tier ?? "unlimited");
      setAlerts(al.alerts ?? []);
      setPrompts(pr.prompts ?? []);
    } catch {
      setError("Could not load history. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeline() {
    const qs = new URLSearchParams();
    qs.set("brandId", brandId);
    qs.set("limit", "250");
    if (engineFilter) qs.set("engine", engineFilter);
    if (typeFilter) qs.set("eventType", typeFilter);
    try {
      const d = await fetch(`/api/history/timeline?${qs.toString()}`).then((x) => x.json());
      setTimeline(d.events ?? []);
    } catch {
      setTimeline([]);
    }
  }

  useEffect(() => {
    loadCore();
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  useEffect(() => {
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineFilter, typeFilter]);

  const engineOptions = useMemo(() => {
    const set = new Set<string>();
    (timeline ?? []).forEach((e) => e.engine_name && set.add(e.engine_name));
    (trends?.byEngine ? Object.keys(trends.byEngine) : []).forEach((e) => set.add(e));
    return Array.from(set).sort();
  }, [timeline, trends]);

  // Merge overall + per-engine series into one row-per-bucket dataset for the chart.
  const chartData = useMemo(() => {
    if (!trends) return [];
    type ChartRow = { bucket: string; label: string; [engine: string]: number | string | null };
    const byBucket = new Map<string, ChartRow>();
    for (const p of trends.overall) {
      byBucket.set(p.bucket, { bucket: p.bucket, label: fmtBucket(p.bucket), overall: p.rate });
    }
    for (const [engine, pts] of Object.entries(trends.byEngine)) {
      for (const p of pts) {
        const row = byBucket.get(p.bucket) ?? { bucket: p.bucket, label: fmtBucket(p.bucket) };
        row[engine] = p.rate;
        byBucket.set(p.bucket, row);
      }
    }
    return Array.from(byBucket.values()).sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
  }, [trends]);

  const chartEngines = useMemo(() => (trends ? Object.keys(trends.byEngine).sort() : []), [trends]);

  async function changeTier(next: string) {
    setSavingTier(true);
    try {
      const res = await fetch("/api/history/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: next }),
      });
      if (res.ok) setTier(next);
    } finally {
      setSavingTier(false);
    }
  }

  async function runBackfill() {
    setBackfillBusy(true);
    setBackfillMsg("");
    try {
      const res = await fetch("/api/history/backfill", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setBackfillMsg(`Replayed ${d.observations ?? 0} past runs into history.`);
        await loadCore();
        await loadTimeline();
      } else {
        setBackfillMsg(d.error ?? "Backfill failed.");
      }
    } finally {
      setBackfillBusy(false);
    }
  }

  async function loadComparison() {
    const qs = new URLSearchParams();
    if (compareAFrom) qs.set("fromA", compareAFrom);
    if (compareATo) qs.set("toA", compareATo);
    if (compareBFrom) qs.set("fromB", compareBFrom);
    if (compareBTo) qs.set("toB", compareBTo);
    try {
      const d = await fetch(`/api/history/compare?${qs.toString()}`).then((x) => x.json());
      setComparison(d.comparison ?? null);
    } catch {
      setComparison(null);
    }
  }

  async function loadPromptDrilldown() {
    if (!selectedPromptId) {
      setPromptObs([]);
      setPromptEvents([]);
      return;
    }
    try {
      const d = await fetch(`/api/history/prompt?promptId=${encodeURIComponent(selectedPromptId)}`).then((x) => x.json());
      setPromptObs(d.observations ?? []);
      setPromptEvents(d.events ?? []);
    } catch {
      setPromptObs([]);
      setPromptEvents([]);
    }
  }

  useEffect(() => {
    loadPromptDrilldown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPromptId, brandId]);

  useEffect(() => {
    loadComparison();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareAFrom, compareATo, compareBFrom, compareBTo, brandId]);

  const hasData =
    insights &&
    (insights.firstMentionByEngine.length > 0 ||
      insights.competitorMovers.length > 0 ||
      insights.citationChanges.gained > 0 ||
      insights.citationChanges.lost > 0 ||
      insights.promptImprovements.length > 0 ||
      (timeline.length > 0));

  return (
    <div className="space-y-6">
      {/* Settings bar: retention tier + backfill */}
      <Panel
        title="History settings"
        description="Control how long your brand's history is retained, and replay existing runs into the historical record."
        bodyClassName="flex flex-wrap items-end gap-5"
      >
        <div>
          <label className="section-label">Retention tier</label>
          <select
            value={tier}
            disabled={savingTier}
            onChange={(e) => changeTier(e.target.value)}
            className="mt-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="unlimited">Unlimited (keep forever)</option>
            <option value="365d">365 days</option>
            <option value="30d">30 days</option>
          </select>
        </div>
        <button
          onClick={runBackfill}
          disabled={backfillBusy}
          className="btn-primary !h-11 disabled:opacity-60"
          title="Replay existing visibility_runs into the immutable history tables"
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${backfillBusy ? "animate-spin" : ""}`} />
          {backfillBusy ? "Replaying…" : "Backfill from existing runs"}
        </button>
        <a href="/api/history/export?type=observations" className="btn-secondary !h-11" download>
          <Download className="mr-1 h-4 w-4" /> Export observations
        </a>
        <a href="/api/history/export?type=events" className="btn-secondary !h-11" download>
          <Download className="mr-1 h-4 w-4" /> Export events
        </a>
        {backfillMsg && <p className="w-full text-sm text-muted">{backfillMsg}</p>}
      </Panel>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.key ? "border-b-2 border-accent text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}
      {loading && <p className="text-sm text-muted">Loading history…</p>}

      {!loading && !hasData && (
        <Panel title="No history yet" description="Historical knowledge is captured automatically as visibility runs accumulate.">
          <div className="flex flex-col gap-3 text-sm text-muted">
            <p>
              Every time {brandName} is checked against an AI engine, the result is stored as an
              immutable observation and compared to the previous one to derive timeline events
              (first mention, lost citation, competitor gaining ground, and more).
            </p>
            <p>
              Once a few weeks of runs have accumulated, this page fills with trends, competitor
              movers, and citation changes. You can also replay your existing runs now with the
              backfill button above.
            </p>
          </div>
        </Panel>
      )}

      {!loading && hasData && tab === "overview" && insights && <OverviewTab insights={insights} alerts={alerts} />}
      {!loading && hasData && tab === "timeline" && (
        <TimelineTab
          events={timeline}
          engineOptions={engineOptions}
          engineFilter={engineFilter}
          typeFilter={typeFilter}
          onEngine={setEngineFilter}
          onType={setTypeFilter}
        />
      )}
      {!loading && hasData && tab === "trends" && (
        <>
          <CompareControl
            comparison={comparison}
            compareAFrom={compareAFrom}
            setCompareAFrom={setCompareAFrom}
            compareATo={compareATo}
            setCompareATo={setCompareATo}
            compareBFrom={compareBFrom}
            setCompareBFrom={setCompareBFrom}
            compareBTo={compareBTo}
            setCompareBTo={setCompareBTo}
          />
          <TrendsTab chartData={chartData} engines={chartEngines} overall={trends?.overall ?? []} />
        </>
      )}
      {!loading && hasData && tab === "competitors" && competitors && (
        <CompetitorsTab trend={competitors.trend} movers={competitors.movers} />
      )}
      {!loading && hasData && tab === "citations" && citations && <CitationsTab c={citations} />}
      {!loading && hasData && tab === "prompts" && (
        <PromptsTab
          prompts={prompts}
          selectedPromptId={selectedPromptId}
          onSelect={setSelectedPromptId}
          observations={promptObs}
          events={promptEvents}
        />
      )}
      {!loading && hasData && tab === "alerts" && <AlertsTab alerts={alerts} onAck={loadCore} />}
    </div>
  );
}

// ---------- Overview ----------
function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

function OverviewTab({ insights, alerts }: { insights: Insights; alerts: AlertRow[] }) {
  const gaining = insights.competitorMovers.filter((m) => m.trend === "gaining");
  const losing = insights.competitorMovers.filter((m) => m.trend === "losing");
  const improved = insights.promptImprovements.filter((p) => (p.delta ?? 0) > 0).slice(0, 6);
  const firstMention = [...insights.firstMentionByEngine].sort((a, b) => (a.observed_at < b.observed_at ? -1 : 1));
  const unacked = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="First mentioned"
          value={firstMention.length ? fmtDate(firstMention[0].observed_at) : "—"}
          hint={firstMention.length ? `on ${firstMention[0].engine}` : "No mentions recorded yet"}
        />
        <StatTile label="Competitors gaining" value={String(gaining.length)} hint="vs your brand" />
        <StatTile label="Competitors losing" value={String(losing.length)} hint="vs your brand" />
        <StatTile label="Open alerts" value={String(unacked)} hint="unaddressed visibility losses" />
        <StatTile
          label="Citations"
          value={`${insights.citationChanges.gained}/${insights.citationChanges.lost}`}
          hint="gained / lost"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="First recommended by" description="When each engine first surfaced the brand.">
          {firstMention.length === 0 ? (
            <p className="text-sm text-muted">No recorded first mentions yet.</p>
          ) : (
            <ul className="space-y-2">
              {firstMention.map((f) => (
                <li key={f.engine} className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize text-ink">{f.engine}</span>
                  <span className="text-muted">{fmtDate(f.observed_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Competitors moving" description="Net visibility shift vs your brand over the window.">
          {insights.competitorMovers.length === 0 ? (
            <p className="text-sm text-muted">No competitor movement recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {insights.competitorMovers.map((m) => (
                <li key={m.name} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{m.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      m.trend === "gaining" ? "bg-rose-50 text-rose-600" : m.trend === "losing" ? "bg-emerald-50 text-emerald-600" : "bg-grid text-muted"
                    }`}
                  >
                    {m.trend === "gaining" ? "+" : ""}
                    {m.delta} pts · {m.trend}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {improved.length > 0 && (
        <Panel title="Prompts improving" description="Recent 30d mention rate vs the prior window — signals content updates are working.">
          <ul className="space-y-2">
            {improved.map((p) => (
              <li key={p.prompt_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-ink">&ldquo;{p.prompt_text}&rdquo;</span>
                <span className="flex shrink-0 items-center gap-1 font-semibold text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                  {p.delta} pts
                  <span className="font-normal text-muted">
                    ({p.priorRate ?? "—"}% → {p.recentRate ?? "—"}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {insights.engineChangeSignals > 0 && (
        <p className="text-sm text-muted">
          <Sparkles className="mr-1 inline h-4 w-4" />
          {insights.engineChangeSignals} engine-change signal(s) detected — a response changed
          materially and the mention verdict flipped. Heuristic, not proof of an engine update.
        </p>
      )}
    </div>
  );
}

// ---------- Timeline ----------
function TimelineTab({
  events, engineOptions, engineFilter, typeFilter, onEngine, onType,
}: {
  events: EventRow[];
  engineOptions: string[];
  engineFilter: string;
  typeFilter: string;
  onEngine: (v: string) => void;
  onType: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="section-label">Engine</label>
          <select value={engineFilter} onChange={(e) => onEngine(e.target.value)} className="mt-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="">All engines</option>
            {engineOptions.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="section-label">Event</label>
          <select value={typeFilter} onChange={(e) => onType(e.target.value)} className="mt-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="">All events</option>
            {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted">No events match this filter yet.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[26px] top-1.5 h-3 w-3 rounded-full ring-2 ring-white ${
                e.severity === "positive" ? "bg-emerald-500" : e.severity === "negative" ? "bg-rose-500" : "bg-grid"
              }`} />
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[e.severity] ?? "bg-grid text-muted"}`}>
                  {EVENT_LABELS[e.event_type] ?? e.event_type}
                </span>
                {e.engine_name && <span className="text-xs capitalize text-muted">{e.engine_name}</span>}
                <span className="text-xs text-muted">{fmtDate(e.occurred_at)}</span>
                {detailText(e) && <span className="text-sm text-ink">{detailText(e)}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------- Trends ----------
function TrendsTab({ chartData, engines, overall }: { chartData: any[]; engines: string[]; overall: TrendPoint[] }) {
  if (overall.length === 0) {
    return <p className="text-sm text-muted">Not enough observation history to chart a trend yet.</p>;
  }
  return (
    <div className="space-y-6">
      <Panel title="Mention rate over time" description="Brand mention rate by engine, bucketed monthly. Gaps mean a month with no qualifying runs (never a fabricated 0%)." bodyClassName="p-0">
        <div className="h-80 w-full p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} unit="%" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="overall" name="Overall" stroke={ENGINE_COLORS[0]} strokeWidth={2.5} dot={false} connectNulls={false} />
              {engines.map((e, i) => (
                <Line key={e} type="monotone" dataKey={e} name={e} stroke={ENGINE_COLORS[(i + 1) % ENGINE_COLORS.length]} strokeWidth={1.5} dot={false} connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Monthly mention rate" description="Per-bucket breakdown (overall).">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Month</th>
                <th className="px-4 py-2 font-semibold">Runs</th>
                <th className="px-4 py-2 font-semibold">Mentioned</th>
                <th className="px-4 py-2 font-semibold">Rate</th>
              </tr>
            </thead>
            <tbody>
              {overall.map((p) => (
                <tr key={p.bucket} className="border-b border-line/60">
                  <td className="px-4 py-2 font-medium">{fmtBucket(p.bucket)}</td>
                  <td className="px-4 py-2 text-muted">{p.total}</td>
                  <td className="px-4 py-2 text-muted">{p.mentioned}</td>
                  <td className="px-4 py-2 font-semibold">{p.rate == null ? "—" : `${p.rate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ---------- Competitors ----------
function CompetitorsTab({ trend, movers }: { trend: CompetitorTrend; movers: Mover[] }) {
  const names = Object.keys(trend).sort();
  const months = useMemo(() => {
    const set = new Set<string>();
    names.forEach((n) => (trend[n] ?? []).forEach((p) => set.add(p.month)));
    return Array.from(set).sort().slice(-8);
  }, [trend]);

  const rateOf = (name: string, month: string): number | null => {
    const pt = (trend[name] ?? []).find((p) => p.month === month);
    if (!pt || pt.total === 0) return null;
    return Math.round((pt.mentioned / pt.total) * 100);
  };

  return (
    <div className="space-y-6">
      <Panel title="Competitor movers" description="Net visibility shift vs your brand over the window.">
        {movers.length === 0 ? (
          <p className="text-sm text-muted">No competitor movement recorded yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {movers.map((m) => (
              <li key={m.name} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm">
                <span className="font-medium text-ink">{m.name}</span>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  m.trend === "gaining" ? "bg-rose-50 text-rose-600" : m.trend === "losing" ? "bg-emerald-50 text-emerald-600" : "bg-grid text-muted"
                }`}>
                  {m.trend === "gaining" ? <TrendingUp className="h-3.5 w-3.5" /> : m.trend === "losing" ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                  {m.trend === "gaining" ? "+" : ""}{m.delta} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {names.length > 0 && (
        <Panel title="Monthly mention rate by competitor" description="Share of that competitor's tracked runs where it was mentioned. Built only from recorded data." bodyClassName="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Competitor</th>
                {months.map((m) => <th key={m} className="px-4 py-2 font-semibold">{fmtBucket(m + "-01")}</th>)}
              </tr>
            </thead>
            <tbody>
              {names.map((n) => (
                <tr key={n} className="border-b border-line/60">
                  <td className="px-4 py-2 font-medium">{n}</td>
                  {months.map((m) => {
                    const r = rateOf(n, m);
                    return (
                      <td key={m} className="px-4 py-2 text-muted">
                        {r == null ? "—" : `${r}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

// ---------- Citations ----------
function CitationsTab({ c }: { c: CitationChanges }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Citations gained" description={`${c.gained} gained over the window.`}>
        {c.gainedDomains.length === 0 ? (
          <p className="text-sm text-muted">No gained citations in this window.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {c.gainedDomains.map((d) => (
              <span key={d} className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" /> {d}
              </span>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Citations lost" description={`${c.lost} lost over the window.`}>
        {c.lostDomains.length === 0 ? (
          <p className="text-sm text-muted">No lost citations in this window.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {c.lostDomains.map((d) => (
              <span key={d} className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                <ArrowDownRight className="h-3.5 w-3.5" /> {d}
              </span>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------- Compare (two windows) ----------
function DeltaPill({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-xs text-muted">—</span>;
  const positive = delta > 0;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${positive ? "bg-emerald-50 text-emerald-600" : delta < 0 ? "bg-rose-50 text-rose-600" : "bg-grid text-muted"}`}>
      {positive ? "+" : ""}{delta} pp
    </span>
  );
}

function CompareControl({
  comparison,
  compareAFrom,
  setCompareAFrom,
  compareATo,
  setCompareATo,
  compareBFrom,
  setCompareBFrom,
  compareBTo,
  setCompareBTo,
}: {
  comparison: ComparisonResult | null;
  compareAFrom: string;
  setCompareAFrom: (v: string) => void;
  compareATo: string;
  setCompareATo: (v: string) => void;
  compareBFrom: string;
  setCompareBFrom: (v: string) => void;
  compareBTo: string;
  setCompareBTo: (v: string) => void;
}) {
  const delta = comparison?.delta;
  const engines = comparison
    ? Array.from(new Set([...Object.keys(comparison.windowA.byEngine), ...Object.keys(comparison.windowB.byEngine)])).sort()
    : [];
  return (
    <Panel title="Compare two windows" description="Before → after mention-rate delta. Honest: an empty window shows — (never 0%).">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="section-label">Window A (before)</label>
          <div className="flex gap-2">
            <input type="date" value={compareAFrom} onChange={(e) => setCompareAFrom(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent" />
            <input type="date" value={compareATo} onChange={(e) => setCompareATo(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="section-label">Window B (after)</label>
          <div className="flex gap-2">
            <input type="date" value={compareBFrom} onChange={(e) => setCompareBFrom(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent" />
            <input type="date" value={compareBTo} onChange={(e) => setCompareBTo(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
        </div>
      </div>

      {comparison && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-ink">Overall</span>
            <span className="text-muted">{comparison.windowA.overall == null ? "—" : `${comparison.windowA.overall}%`}</span>
            <ArrowRight className="h-4 w-4 text-muted" />
            <span className="font-semibold text-ink">{comparison.windowB.overall == null ? "—" : `${comparison.windowB.overall}%`}</span>
            <DeltaPill delta={delta?.overall ?? null} />
          </div>
          {engines.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <tr><th className="px-2 py-2 font-semibold">Engine</th><th className="px-2 py-2 font-semibold">A</th><th className="px-2 py-2 font-semibold">B</th><th className="px-2 py-2 font-semibold">Δ</th></tr>
              </thead>
              <tbody>
                {engines.map((e) => (
                  <tr key={e} className="border-b border-line/60">
                    <td className="px-2 py-1.5 capitalize font-medium">{e}</td>
                    <td className="px-2 py-1.5 text-muted">{comparison.windowA.byEngine[e] == null ? "—" : `${comparison.windowA.byEngine[e]}%`}</td>
                    <td className="px-2 py-1.5 text-muted">{comparison.windowB.byEngine[e] == null ? "—" : `${comparison.windowB.byEngine[e]}%`}</td>
                    <td className="px-2 py-1.5"><DeltaPill delta={delta?.byEngine[e] ?? null} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-muted">
            Citations — A: gained {comparison.citations.windowA.gained} / lost {comparison.citations.windowA.lost} · B: gained {comparison.citations.windowB.gained} / lost {comparison.citations.windowB.lost}
          </p>
        </div>
      )}
    </Panel>
  );
}

// ---------- Prompts (per-prompt drill-down) ----------
function PromptsTab({
  prompts, selectedPromptId, onSelect, observations, events,
}: {
  prompts: PromptOption[];
  selectedPromptId: string;
  onSelect: (id: string) => void;
  observations: PromptObservationRow[];
  events: EventRow[];
}) {
  return (
    <div className="space-y-6">
      <Panel title="Per-prompt history" description="Pick a prompt to see its immutable observation series and the events derived for it.">
        <div>
          <label className="section-label">Prompt</label>
          <select
            value={selectedPromptId}
            onChange={(e) => onSelect(e.target.value)}
            className="mt-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent min-w-[260px]"
          >
            <option value="">Select a prompt…</option>
            {prompts.map((p) => <option key={p.id} value={p.id}>{p.text}</option>)}
          </select>
        </div>
      </Panel>

      {!selectedPromptId ? (
        <p className="text-sm text-muted">Select a prompt above to drill down into its history.</p>
      ) : (
        <>
          <Panel title="Observation series" description="Every immutable snapshot for this prompt (newest first).">
            {observations.length === 0 ? (
              <p className="text-sm text-muted">No observations recorded for this prompt yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Engine</th>
                      <th className="px-3 py-2 font-semibold">Mentioned</th>
                      <th className="px-3 py-2 font-semibold">Position</th>
                      <th className="px-3 py-2 font-semibold">Sentiment</th>
                      <th className="px-3 py-2 font-semibold">Alignment</th>
                      <th className="px-3 py-2 font-semibold">Skipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.map((o, i) => (
                      <tr key={i} className="border-b border-line/60">
                        <td className="px-3 py-2 text-muted">{fmtDate(o.observed_at)}</td>
                        <td className="px-3 py-2 capitalize">{o.engine_name ?? "—"}</td>
                        <td className="px-3 py-2">{o.brand_mentioned == null ? "—" : o.brand_mentioned ? "✓" : "✗"}</td>
                        <td className="px-3 py-2 text-muted">{o.brand_position ?? "—"}</td>
                        <td className="px-3 py-2 capitalize text-muted">{o.sentiment ?? "—"}</td>
                        <td className="px-3 py-2 capitalize text-muted">{o.recommendation_alignment ?? "—"}</td>
                        <td className="px-3 py-2 text-muted">{o.skipped ? "skip" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Events for this prompt" description="Timeline deltas derived for this prompt.">
            {events.length === 0 ? (
              <p className="text-sm text-muted">No events derived for this prompt yet.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[e.severity] ?? "bg-grid text-muted"}`}>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                    {e.engine_name && <span className="text-xs capitalize text-muted">{e.engine_name}</span>}
                    <span className="text-xs text-muted">{fmtDate(e.occurred_at)}</span>
                    {detailText(e) && <span className="text-ink">{detailText(e)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------- Alerts ----------
const ALERT_LABELS: Record<string, string> = {
  mention_lost: "Mention lost",
  citation_lost: "Citation lost",
  competitor_gained: "Competitor gained",
  position_dropped: "Position dropped",
  recommendation_lost: "Recommendation lost",
};

function AlertsTab({ alerts, onAck }: { alerts: AlertRow[]; onAck: () => void }) {
  async function ack(id: string) {
    try {
      await fetch(`/api/history/alerts/${id}/ack`, { method: "PUT" });
      onAck();
    } catch {
      /* ignore */
    }
  }
  return (
    <Panel title="History alerts" description="Negative timeline events — your most actionable visibility losses. Acknowledge to clear them.">
      {alerts.length === 0 ? (
        <p className="text-sm text-muted">No alerts yet — no negative visibility changes recorded.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.acknowledged ? "bg-grid text-muted" : "bg-rose-50 text-rose-600"}`}>{ALERT_LABELS[a.alert_type] ?? a.alert_type}</span>
              {a.engine_name && <span className="text-xs capitalize text-muted">{a.engine_name}</span>}
              <span className="text-xs text-muted">{fmtDate(a.occurred_at)}</span>
              {detailText({ detail: a.detail } as EventRow) && <span className="text-ink">{detailText({ detail: a.detail } as EventRow)}</span>}
              <span className="ml-auto">
                {a.acknowledged ? (
                  <span className="text-xs text-muted">acknowledged</span>
                ) : (
                  <button onClick={() => ack(a.id)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:border-ink/20">Acknowledge</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
