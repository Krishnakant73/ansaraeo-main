// Alerting for the geo-metrics layer.
//
// Users define threshold rules (e.g. "citation_rate drops ≥15pp vs prior 7d",
// "avg_rank worsens ≥2 positions", "model_divergence spikes ≥10"). The nightly
// metrics-snapshot cron evaluates every active rule for every brand against the
// persisted geo_metric_snapshots and records a geo_alert_firings row when one
// is breached (deduped per rule so a sustained breach doesn't spam).
//
// evaluateRule is pure + unit-tested; the rest is thin Supabase CRUD.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AlertMetric =
  | "visibility_rate"
  | "citation_rate"
  | "citation_share"
  | "avg_rank"
  | "model_divergence"
  | "recommendation_quality";

export type AlertDirection = "up" | "down";
export type AlertMode = "delta" | "level";

export type AlertRule = {
  id: string;
  brand_id: string;
  metric: AlertMetric;
  window: "7d" | "30d";
  direction: AlertDirection;
  mode: AlertMode;
  threshold: number;
  is_active: boolean;
};

export type CreateRuleInput = {
  brand_id: string;
  metric: AlertMetric;
  window: "7d" | "30d";
  direction: AlertDirection;
  mode?: AlertMode;
  threshold: number;
};

export const VALID_METRICS: AlertMetric[] = [
  "visibility_rate",
  "citation_rate",
  "citation_share",
  "avg_rank",
  "model_divergence",
  "recommendation_quality",
];

// DB stores the window under `window_type` (Postgres reserves `window` as a
// keyword). Map it back to the `window` field the rest of the code expects.
type RuleRow = Omit<AlertRule, "window"> & { window_type: AlertRule["window"] };
function rowToRule(row: RuleRow): AlertRule {
  const { window_type, ...rest } = row;
  return { ...rest, window: window_type };
}

// Pure decision: does the rule fire given the current (and optional previous)
// metric value? Returns only the boolean — keeps the DB layer trivial to test.
export function evaluateRule(
  rule: { direction: AlertDirection; mode: AlertMode; threshold: number },
  currentValue: number | null,
  previousValue: number | null = null,
): { breached: boolean } {
  if (currentValue === null) return { breached: false };
  if (rule.mode === "level") {
    return {
      breached: rule.direction === "down" ? currentValue <= rule.threshold : currentValue >= rule.threshold,
    };
  }
  // delta mode: compare against the previous snapshot
  if (previousValue === null) return { breached: false };
  const delta = currentValue - previousValue;
  return {
    breached: rule.direction === "down" ? delta <= -rule.threshold : delta >= rule.threshold,
  };
}

export async function createAlertRule(supabase: SupabaseClient, input: CreateRuleInput): Promise<AlertRule> {
  const { data, error } = await supabase
    .from("geo_alert_rules")
    .insert({
      brand_id: input.brand_id,
      metric: input.metric,
      window_type: input.window,
      direction: input.direction,
      mode: input.mode ?? "delta",
      threshold: input.threshold,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToRule(data as RuleRow);
}

export async function listAlertRules(supabase: SupabaseClient, brandId: string): Promise<AlertRule[]> {
  const { data } = await supabase
    .from("geo_alert_rules")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as RuleRow[]).map(rowToRule);
}

export async function deleteAlertRule(supabase: SupabaseClient, ruleId: string, brandId: string): Promise<void> {
  await supabase.from("geo_alert_rules").delete().eq("id", ruleId).eq("brand_id", brandId);
}

export async function listFirings(
  supabase: SupabaseClient,
  brandId: string,
  limit = 20,
): Promise<any[]> {
  const { data } = await supabase
    .from("geo_alert_firings")
    .select("*")
    .eq("brand_id", brandId)
    .order("fired_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// Evaluate every active rule for a brand against its latest + previous
// snapshot, writing a firing row on breach (deduped over the last 7 days).
export async function fireAlertsForBrand(
  supabase: SupabaseClient,
  brandId: string,
): Promise<number> {
  const rules = (await listAlertRules(supabase, brandId)).filter((r) => r.is_active);
  if (!rules.length) return 0;

  const { data: snaps } = await supabase
    .from("geo_metric_snapshots")
    .select("metrics, window_type, snapshot_date")
    .eq("brand_id", brandId)
    .order("snapshot_date", { ascending: false })
    .limit(20);

  if (!snaps || !snaps.length) return 0;

  let fired = 0;
  for (const rule of rules) {
    const windowSnaps = snaps.filter((s) => s.window_type === rule.window);
    const latest = windowSnaps[0]?.metrics as Record<string, number | null> | undefined;
    const previous = windowSnaps[1]?.metrics as Record<string, number | null> | undefined;
    if (!latest) continue;

    const currentValue = (latest[rule.metric] as number | null) ?? null;
    const previousValue = previous ? ((previous[rule.metric] as number | null) ?? null) : null;
    const { breached } = evaluateRule(rule, currentValue, previousValue);
    if (!breached) continue;

    // Dedupe: skip if an unacknowledged firing for this rule already exists in 7d.
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: existing } = await supabase
      .from("geo_alert_firings")
      .select("id")
      .eq("rule_id", rule.id)
      .eq("acknowledged", false)
      .gte("fired_at", since)
      .limit(1);
    if (existing && existing.length) continue;

    const { error } = await supabase.from("geo_alert_firings").insert({
      rule_id: rule.id,
      brand_id: brandId,
      metric: rule.metric,
      window_type: rule.window,
      metric_value: currentValue,
      previous_value: previousValue,
      threshold: rule.threshold,
      detail: { direction: rule.direction, mode: rule.mode },
    });
    if (!error) fired += 1;
  }
  return fired;
}
