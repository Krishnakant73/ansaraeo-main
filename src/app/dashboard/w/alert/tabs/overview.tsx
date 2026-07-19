import InsightCard from "@/workspace/primitives/InsightCard";
import { metricLabel, ruleSummary, timeAgo, type Alert } from "@/lib/alert-workspace";

// ============================================================
// Alert › Overview — what the rule watches + recent firing volume.
// ============================================================

export default function OverviewBody({ alert }: { alert: Alert }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <p className="section-label">{metricLabel(alert.metric)}</p>
        <p className="mt-1 text-base leading-relaxed text-ink">{ruleSummary(alert)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={
              alert.is_active
                ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                : "chip"
            }
          >
            {alert.is_active ? "Active" : "Paused"}
          </span>
          <span className="chip">Direction: {alert.direction}</span>
          <span className="chip">Mode: {alert.mode}</span>
          <span className="chip">Window: {alert.window_type}</span>
          <span className="chip">Threshold: {alert.threshold}</span>
        </div>
      </section>

      {!alert.is_active && (
        <InsightCard
          variant="info"
          title="Rule is paused"
          description="No new firings will be recorded until you re-activate. Existing firings remain."
        />
      )}
      {alert.stats.unacknowledgedCount > 0 && (
        <InsightCard
          variant="warning"
          title={`${alert.stats.unacknowledgedCount} unacknowledged firing${alert.stats.unacknowledgedCount === 1 ? "" : "s"}`}
          description="Review recent firings and acknowledge to clear the queue."
          href={`/dashboard/w/alert/${alert.id}/firings`}
        />
      )}
      {alert.is_active && alert.stats.firingCount30d === 0 && (
        <InsightCard
          variant="win"
          title="Quiet last 30 days"
          description="No firings — the metric hasn't crossed the threshold. Rule is armed and watching."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title="Firings 30d"
          description={`${alert.stats.firingCount30d} in the last 30 days · ${alert.stats.firingCountAllTime} all-time.`}
          href={`/dashboard/w/alert/${alert.id}/firings`}
          meta="History"
        />
        <InsightCard
          variant="info"
          title="Last firing"
          description={alert.stats.lastFiringAt ? timeAgo(alert.stats.lastFiringAt) : "never"}
          meta="Timestamp"
        />
      </div>
    </div>
  );
}
