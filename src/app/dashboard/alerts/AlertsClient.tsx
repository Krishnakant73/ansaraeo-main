"use client";

import { useEffect, useState } from "react";
import { Bell, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";

type Rule = {
  id: string;
  metric: string;
  window: "7d" | "30d";
  direction: "up" | "down";
  mode: "delta" | "level";
  threshold: number;
  is_active: boolean;
};

type Firing = {
  id: string;
  metric: string;
  window: string | null;
  fired_at: string;
  metric_value: number | null;
  previous_value: number | null;
  threshold: number;
};

const METRICS = [
  { key: "visibility_rate", label: "Visibility rate" },
  { key: "citation_rate", label: "Citation rate" },
  { key: "citation_share", label: "Citation share" },
  { key: "avg_rank", label: "Avg rank" },
  { key: "model_divergence", label: "Model divergence" },
  { key: "recommendation_quality", label: "Recommendation quality" },
];

const metricLabel = (k: string) => METRICS.find((m) => m.key === k)?.label ?? k;

export default function AlertsClient({ brandId }: { brandId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [firings, setFirings] = useState<Firing[]>([]);
  const [metric, setMetric] = useState("citation_rate");
  const [window, setWindow] = useState<"7d" | "30d">("7d");
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [mode, setMode] = useState<"delta" | "level">("delta");
  const [threshold, setThreshold] = useState("15");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [r, f] = await Promise.all([
      fetch(`/api/alerts/rule?brandId=${brandId}`).then((res) => res.json()),
      fetch(`/api/alerts/firings?brandId=${brandId}`).then((res) => res.json()),
    ]);
    setRules(r.rules ?? []);
    setFirings(f.firings ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/alerts/rule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId,
        metric,
        window,
        direction,
        mode,
        threshold: Number(threshold),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to create rule");
      return;
    }
    await load();
  }

  async function remove(ruleId: string) {
    setBusy(true);
    await fetch("/api/alerts/rule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId, brandId }),
    });
    setBusy(false);
    await load();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <Panel title="Create an alert rule" description="Evaluated nightly against the persisted snapshot.">
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="section-label">Metric</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="mt-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent">
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="section-label">When it</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as "up" | "down")} className="mt-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="down">drops / worsens</option>
              <option value="up">rises / spikes</option>
            </select>
          </div>
          <div>
            <label className="section-label">By</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as "delta" | "level")} className="mt-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="delta">vs prior window (pp)</option>
              <option value="level">absolute level</option>
            </select>
          </div>
          <div>
            <label className="section-label">Threshold</label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="mt-1 w-24 rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </div>
          <div>
            <label className="section-label">Window</label>
            <select value={window} onChange={(e) => setWindow(e.target.value as "7d" | "30d")} className="mt-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="7d">7d</option>
              <option value="30d">30d</option>
            </select>
          </div>
          <button type="submit" disabled={busy} className="btn-primary !h-11 disabled:opacity-60">
            <Bell className="mr-1 h-4 w-4" /> Add rule
          </button>
        </form>
      </Panel>

      <Panel title="Your rules" description={`${rules.length} active rule${rules.length === 1 ? "" : "s"}`}>
        {rules.length === 0 ? (
          <p className="text-sm text-muted">No rules yet — create one above.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm">
                  <span className="font-semibold text-ink">{metricLabel(r.metric)}</span>{" "}
                  {r.direction === "down" ? (
                    <ArrowDown className="inline h-3.5 w-3.5 text-rose-500" />
                  ) : (
                    <ArrowUp className="inline h-3.5 w-3.5 text-emerald-500" />
                  )}{" "}
                  {r.mode === "delta" ? `≥ ${r.threshold}pp vs prior` : `crosses ${r.threshold}`} ({r.window})
                </span>
                <button onClick={() => remove(r.id)} disabled={busy} className="rounded-full border border-line px-2 py-1 text-xs text-muted transition hover:border-rose-300 hover:text-rose-500 disabled:opacity-60">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recent firings" description="Recorded by the nightly cron when a rule was breached.">
        {firings.length === 0 ? (
          <p className="text-sm text-muted">No firings yet — they appear after the nightly snapshot evaluates your rules.</p>
        ) : (
          <ul className="space-y-2">
            {firings.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold text-ink">{metricLabel(f.metric)}</span>{" "}
                  <span className="text-muted">
                    {f.metric_value ?? "—"}{f.previous_value != null ? ` (was ${f.previous_value})` : ""} · threshold {f.threshold}
                  </span>
                </span>
                <span className="text-xs text-muted">{new Date(f.fired_at).toLocaleDateString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
