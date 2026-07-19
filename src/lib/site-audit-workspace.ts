// ============================================================
// Site Audit workspace loader + shape.
//
// Site audits live in migration_004. Each audit is a snapshot: an
// overall score, three sub-scores, an llms_txt-present flag, and a
// JSONB `issues` list of {check, status, detail, fix}. Audits are
// immutable — a new audit is a new row, not an update.
//
// getAuditById(id) — cookie-scoped, RLS-safe, null → 404. Embeds
// the parent brand + a lightweight previous-audit reference so the
// workspace can show delta.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type SiteAuditIssue = {
  check: string;                    // slug/name of the check
  status: string;                   // pass|warn|fail
  detail?: string;
  fix?: string;
};

export type SiteAuditStats = {
  issueCount: number;
  failCount: number;
  warnCount: number;
  passCount: number;
  ageInDays: number;
  overallDelta: number | null;      // vs previous audit, in points
};

export type SiteAuditBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
};

export type SiteAudit = {
  id: string;
  brand_id: string;
  run_at: string;
  overall_score: number | null;
  schema_markup_score: number | null;
  crawlability_score: number | null;
  llms_txt_present: boolean | null;
  issues: SiteAuditIssue[];
  brand: SiteAuditBrand;
  stats: SiteAuditStats;
};

const BRAND_COLUMNS = "id, name, slug, domain";

export async function getSiteAuditById(id: string): Promise<SiteAudit | null> {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("site_audits")
    .select(
      "id, brand_id, run_at, overall_score, schema_markup_score, crawlability_score, llms_txt_present, issues",
    )
    .eq("id", id)
    .maybeSingle();
  if (!a) return null;

  const audit = a as {
    id: string;
    brand_id: string;
    run_at: string;
    overall_score: number | null;
    schema_markup_score: number | null;
    crawlability_score: number | null;
    llms_txt_present: boolean | null;
    issues: unknown;
  };

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", audit.brand_id)
    .maybeSingle();
  if (!brand) return null;

  const issues = normalizeIssues(audit.issues);

  // Previous audit for delta.
  const { data: prev } = await supabase
    .from("site_audits")
    .select("id, overall_score, run_at")
    .eq("brand_id", audit.brand_id)
    .lt("run_at", audit.run_at)
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previous = prev as { id: string; overall_score: number | null; run_at: string } | null;

  const overallDelta =
    audit.overall_score != null && previous?.overall_score != null
      ? audit.overall_score - previous.overall_score
      : null;

  const stats: SiteAuditStats = {
    issueCount: issues.length,
    failCount: issues.filter((i) => i.status === "fail").length,
    warnCount: issues.filter((i) => i.status === "warn").length,
    passCount: issues.filter((i) => i.status === "pass").length,
    ageInDays: Math.max(0, Math.floor((Date.now() - new Date(audit.run_at).getTime()) / 86_400_000)),
    overallDelta,
  };

  return {
    ...audit,
    issues,
    brand: brand as SiteAuditBrand,
    stats,
  };
}

function normalizeIssues(input: unknown): SiteAuditIssue[] {
  if (!Array.isArray(input)) return [];
  return (input as unknown[]).map((row) => {
    const r = row as { check?: unknown; status?: unknown; detail?: unknown; fix?: unknown };
    return {
      check: typeof r.check === "string" ? r.check : "unknown",
      status: typeof r.status === "string" ? r.status : "unknown",
      detail: typeof r.detail === "string" ? r.detail : undefined,
      fix: typeof r.fix === "string" ? r.fix : undefined,
    };
  });
}

export function statusChipClass(status: string): string {
  switch (status) {
    case "pass":
      return "chip border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warn":
      return "chip border-amber-200 bg-amber-50 text-amber-700";
    case "fail":
      return "chip border-rose-200 bg-rose-50 text-rose-600";
    default:
      return "chip";
  }
}

export function scoreTone(score: number | null): "positive" | "negative" | undefined {
  if (score == null) return undefined;
  if (score >= 80) return "positive";
  if (score < 50) return "negative";
  return undefined;
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
