// ============================================================
// Playbook workspace loader + shape.
//
// Playbooks live in migration_021 (workflow core). Each playbook is
// org-scoped and holds a JSONB `steps` array of {title, type, action}
// step templates. Playbooks are instantiated on trigger (manual,
// opportunity_type, or engine) — the schema doesn't wire generated
// missions back to the playbook that created them, so we don't try
// to surface a "runs" tab.
//
// getPlaybookById(id) — cookie-scoped, RLS-safe, null → 404.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type PlaybookStep = {
  title: string;
  type?: string;                    // fix|content|approve|deploy|verify
  action?: Record<string, unknown>; // engine action payload template
};

export type PlaybookStats = {
  stepCount: number;
  hasVerifyStep: boolean;
  hasApprovalStep: boolean;
  ageInDays: number;
};

export type PlaybookOrg = {
  id: string;
  name: string | null;
};

export type Playbook = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  trigger_type: string;             // opportunity_type|engine|manual
  steps: PlaybookStep[];
  is_active: boolean;
  created_at: string;
  org: PlaybookOrg;
  stats: PlaybookStats;
};

export async function getPlaybookById(id: string): Promise<Playbook | null> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("playbooks")
    .select("id, org_id, name, description, trigger_type, steps, is_active, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;

  const row = p as Omit<Playbook, "org" | "stats"> & { steps: unknown };

  const stepsArr: PlaybookStep[] = Array.isArray(row.steps)
    ? (row.steps as unknown[]).map((s) => {
        const step = s as { title?: unknown; type?: unknown; action?: unknown };
        return {
          title: typeof step.title === "string" ? step.title : "Untitled step",
          type: typeof step.type === "string" ? step.type : undefined,
          action:
            step.action && typeof step.action === "object"
              ? (step.action as Record<string, unknown>)
              : undefined,
        };
      })
    : [];

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", row.org_id)
    .maybeSingle();

  const stats: PlaybookStats = {
    stepCount: stepsArr.length,
    hasVerifyStep: stepsArr.some((s) => s.type === "verify"),
    hasApprovalStep: stepsArr.some((s) => s.type === "approve"),
    ageInDays: Math.max(
      0,
      Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86_400_000),
    ),
  };

  return {
    ...row,
    steps: stepsArr,
    org: (org as PlaybookOrg | null) ?? { id: row.org_id, name: null },
    stats,
  };
}

export function triggerLabel(t: string): string {
  switch (t) {
    case "opportunity_type":
      return "Opportunity type";
    case "engine":
      return "Engine event";
    case "manual":
      return "Manual only";
    default:
      return t;
  }
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
