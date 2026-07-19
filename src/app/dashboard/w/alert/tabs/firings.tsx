import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import { Bell } from "lucide-react";
import { timeAgo, type Alert } from "@/lib/alert-workspace";

// ============================================================
// Alert › Firings — chronological log with metric value + previous
// value + threshold recorded at firing time. Non-editable — you
// can ack from the classic /alerts page.
// ============================================================

type Row = {
  id: string;
  fired_at: string;
  metric_value: number | null;
  previous_value: number | null;
  threshold: number | null;
  acknowledged: boolean | null;
};

export default async function FiringsBody({ alert }: { alert: Alert }) {
  const supabase = await createClient();
  const { data: firings } = await supabase
    .from("geo_alert_firings")
    .select("id, fired_at, metric_value, previous_value, threshold, acknowledged")
    .eq("rule_id", alert.id)
    .order("fired_at", { ascending: false })
    .limit(200);
  const rows = (firings as Row[] | null) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Firings</h2>
        <p className="mt-1 text-sm text-muted">
          Every time this rule fired, with the metric value at the moment. Ack from the
          classic Alerts page — this view is read-only for now.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyStateCoach
          icon={Bell}
          title="No firings recorded"
          description="The rule hasn't crossed its threshold yet — that's the healthy state. Adjust the threshold on the classic Alerts page if you want tighter coverage."
          secondary={{
            label: "Manage alert rules",
            href: `/dashboard/b/${alert.brand.slug}/alerts`,
          }}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 text-right font-semibold">Metric</th>
                <th className="px-4 py-3 text-right font-semibold">Prev</th>
                <th className="px-4 py-3 text-right font-semibold">Threshold</th>
                <th className="px-4 py-3 font-semibold">Ack</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-surface">
                  <td className="px-4 py-3 text-xs text-muted">{timeAgo(r.fired_at)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-ink">
                    {r.metric_value ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                    {r.previous_value ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                    {r.threshold ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.acknowledged ? (
                      <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                        acked
                      </span>
                    ) : (
                      <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                        open
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
