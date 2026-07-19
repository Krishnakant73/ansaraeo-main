// ============================================================
// Alert (rule) workspace loader.
//
// geo_alert_rules (migration_013) define WHEN we alert; firings live
// in geo_alert_firings. The workspace shows the rule + its firing
// history so operators can see effect on live data.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type AlertBrand = {
  id: string;
  name: string;
  slug: string;
};

export type AlertStats = {
  firingCount30d: number;
  firingCountAllTime: number;
  unacknowledgedCount: number;
  lastFiringAt: string | null;
};

export type Alert = {
  id: string;
  brand_id: string;
  metric: string;
  window_type: string;
  direction: string;         // up|down
  mode: string;              // delta|level
  threshold: number;
  is_active: boolean;
  created_at: string;
  brand: AlertBrand;
  stats: AlertStats;
};

const BRAND_COLUMNS = "id, name, slug";

export async function getAlertById(id: string): Promise<Alert | null> {
  const supabase = await createClient();
  const { data: rule } = await supabase
    .from("geo_alert_rules")
    .select("id, brand_id, metric, window_type, direction, mode, threshold, is_active, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!rule) return null;

  const row = rule as Omit<Alert, "brand" | "stats">;
  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", row.brand_id)
    .maybeSingle();
  if (!brand) return null;

  const stats = await loadAlertStats(id, supabase);

  return { ...row, brand: brand as AlertBrand, stats };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAlertStats(alertId: string, supabase: any): Promise<AlertStats> {
  const { data: firings } = await supabase
    .from("geo_alert_firings")
    .select("id, fired_at, acknowledged")
    .eq("rule_id", alertId)
    .order("fired_at", { ascending: false })
    .limit(500);
  const rows = (firings as { id: string; fired_at: string; acknowledged: boolean | null }[] | null) ?? [];
  const now = Date.now();
  const cutoff30 = now - 30 * 86_400_000;
  const in30 = rows.filter((r) => new Date(r.fired_at).getTime() >= cutoff30);
  const unack = rows.filter((r) => !r.acknowledged);
  return {
    firingCount30d: in30.length,
    firingCountAllTime: rows.length,
    unacknowledgedCount: unack.length,
    lastFiringAt: rows[0]?.fired_at ?? null,
  };
}

export function metricLabel(metric: string): string {
  switch (metric) {
    case "visibility_rate": return "Visibility rate";
    case "citation_rate": return "Citation rate";
    case "citation_share": return "Citation share";
    case "avg_rank": return "Average rank";
    case "model_divergence": return "Model divergence";
    case "recommendation_quality": return "Recommendation quality";
    default: return metric.replace(/_/g, " ");
  }
}

export function ruleSummary(a: Alert): string {
  const metric = metricLabel(a.metric);
  const dir = a.direction === "up" ? "rises" : "drops";
  const mode = a.mode === "delta" ? "changes by" : "reaches";
  const unit = a.metric === "avg_rank" ? "rank points" : "pp";
  return `Alert when ${metric.toLowerCase()} ${dir} — ${mode} ${a.threshold} ${unit} over ${a.window_type}.`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
