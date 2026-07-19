import { metricLabel, ruleSummary, timeAgo, type Alert } from "@/lib/alert-workspace";

// ============================================================
// Alert › Rule — the definition rendered as key/value. Non-editable
// inline; editing lives on the classic Alerts page.
// ============================================================

export default function RuleBody({ alert }: { alert: Alert }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Rule</h2>
        <p className="mt-1 text-sm text-muted">{ruleSummary(alert)}</p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-4">
        <dl className="divide-y divide-line">
          <Row label="Metric" value={metricLabel(alert.metric)} raw={alert.metric} />
          <Row label="Window" value={alert.window_type} />
          <Row label="Direction" value={alert.direction} />
          <Row label="Mode" value={alert.mode} />
          <Row label="Threshold" value={String(alert.threshold)} />
          <Row label="Active" value={alert.is_active ? "yes" : "no"} />
          <Row label="Created" value={timeAgo(alert.created_at)} />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value, raw }: { label: string; value: string; raw?: string }) {
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      <dt className="w-40 shrink-0 font-medium text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink">
        {value}
        {raw && (
          <span className="ml-2 rounded bg-surface px-1 font-mono text-[11px] text-muted">
            {raw}
          </span>
        )}
      </dd>
    </div>
  );
}
