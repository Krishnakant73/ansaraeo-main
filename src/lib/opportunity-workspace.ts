// ============================================================
// Opportunity workspace loader.
//
// opportunity_recommendations (migration_020) are the "you should do
// this" queue for a brand. Each row has a type, priority_score,
// estimated_impact JSONB, and moves open → acknowledged → done, with
// dismissed as an escape hatch.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type OpportunityBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
};

export type OpportunityDetail = {
  prompt_id?: string;
  engine?: string;
  competitor?: string;
  domain?: string;
  [k: string]: unknown;
};

export type OpportunityImpact = {
  mentions_per_month?: number;
  visibility_delta?: number;
  [k: string]: unknown;
};

export type OpportunityRelated = {
  prompt?: { id: string; text: string } | null;
  linkedMissionId: string | null;
  linkedMissionTitle: string | null;
};

export type Opportunity = {
  id: string;
  brand_id: string;
  type: string;
  title: string;
  detail: OpportunityDetail;
  estimated_impact: OpportunityImpact;
  priority_score: number | null;
  status: string;
  created_at: string;
  brand: OpportunityBrand;
  related: OpportunityRelated;
};

const BRAND_COLUMNS = "id, name, slug, domain";

export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("opportunity_recommendations")
    .select("id, brand_id, type, title, detail, estimated_impact, priority_score, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;
  const item = row as Omit<Opportunity, "brand" | "related"> & {
    detail: OpportunityDetail | null;
    estimated_impact: OpportunityImpact | null;
  };

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", item.brand_id)
    .maybeSingle();
  if (!brand) return null;

  const detail: OpportunityDetail = item.detail ?? {};
  const impact: OpportunityImpact = item.estimated_impact ?? {};

  let prompt: { id: string; text: string } | null = null;
  if (detail.prompt_id) {
    const { data: p } = await supabase
      .from("prompts")
      .select("id, text")
      .eq("id", detail.prompt_id)
      .maybeSingle();
    prompt = (p as { id: string; text: string } | null) ?? null;
  }

  // Missions can reference an opportunity via a task's source_opportunity_id.
  let linkedMissionId: string | null = null;
  let linkedMissionTitle: string | null = null;
  const { data: task } = await supabase
    .from("tasks")
    .select("mission_id")
    .eq("source_opportunity_id", id)
    .limit(1)
    .maybeSingle();
  if (task) {
    linkedMissionId = (task as { mission_id: string }).mission_id;
    const { data: m } = await supabase
      .from("missions")
      .select("title")
      .eq("id", linkedMissionId)
      .maybeSingle();
    linkedMissionTitle = (m as { title: string } | null)?.title ?? null;
  }

  return {
    ...item,
    detail,
    estimated_impact: impact,
    brand: brand as OpportunityBrand,
    related: { prompt, linkedMissionId, linkedMissionTitle },
  };
}

export function opportunityTypeLabel(type: string): string {
  switch (type) {
    case "citation_gap": return "Citation gap";
    case "position_gap": return "Position gap";
    case "intent_coverage": return "Intent coverage";
    case "competitor_exposure": return "Competitor exposure";
    case "schema_missing": return "Schema missing";
    default: return type.replace(/_/g, " ");
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
