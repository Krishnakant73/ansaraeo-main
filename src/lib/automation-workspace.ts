// ============================================================
// Automation workspace loader.
//
// automations (migration_021) are event → action rules attached to a
// brand. `trigger` is {type, config} JSONB; `actions` is [{type,
// config}]. Everything else is trivial (name, description, is_active,
// timestamps). The workspace exposes trigger + actions and keeps
// server-side toggle simple.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type AutomationBrand = {
  id: string;
  name: string;
  slug: string;
};

export type AutomationTrigger = {
  type?: string;
  config?: Record<string, unknown>;
  [k: string]: unknown;
};

export type AutomationAction = {
  type?: string;
  config?: Record<string, unknown>;
  [k: string]: unknown;
};

export type AutomationStats = {
  actionCount: number;
  ageInDays: number | null;
  hasTrigger: boolean;
};

export type Automation = {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  brand: AutomationBrand;
  stats: AutomationStats;
};

const BRAND_COLUMNS = "id, name, slug";

export async function getAutomationById(id: string): Promise<Automation | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("automations")
    .select("id, brand_id, name, description, trigger, actions, is_active, created_by, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;
  const auto = row as Omit<Automation, "brand" | "stats"> & {
    trigger: AutomationTrigger | null;
    actions: AutomationAction[] | null;
  };
  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", auto.brand_id)
    .maybeSingle();
  if (!brand) return null;

  const trigger = auto.trigger ?? {};
  const actions = auto.actions ?? [];
  const ageInDays = auto.created_at
    ? Math.floor((Date.now() - new Date(auto.created_at).getTime()) / 86_400_000)
    : null;

  return {
    ...auto,
    trigger,
    actions,
    brand: brand as AutomationBrand,
    stats: {
      actionCount: actions.length,
      ageInDays,
      hasTrigger: !!(trigger?.type ?? Object.keys(trigger).length > 0),
    },
  };
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
