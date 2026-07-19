import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceClient } from "@/lib/supabase/server";
import { getLatestSnapshot } from "@/lib/snapshots";
import { ReportDocument } from "@/lib/report-document";

// ============================================================
// Extracted from the original /api/reports/generate/route.ts so the
// weekly automated cron (this batch) and the manual "Download PDF" button
// (Batch 17) both generate an IDENTICAL report from the same code path —
// avoids the two ever silently drifting apart.
// ============================================================

export async function generateReportBuffer(brandId: string): Promise<{ buffer: Buffer; brandName: string }> {
  const supabase = createServiceClient();

  const { data: brand } = await supabase.from("brands").select("name, industry").eq("id", brandId).single();
  if (!brand) throw new Error("Brand not found");

  const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brandId);
  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase
        .from("visibility_runs")
        .select("id, prompt_id, brand_mentioned, sentiment, competitor_mentions, engines(name)")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
    : { data: [] };

  const totalRuns = runs?.length ?? 0;
  const mentionedRuns = runs?.filter((r) => r.brand_mentioned).length ?? 0;
  const visibilityScore = totalRuns > 0 ? Math.round((mentionedRuns / totalRuns) * 100) : null;

  const engineStats: Record<string, { total: number; mentioned: number }> = {};
  for (const r of runs ?? []) {
    const engineName = (Array.isArray(r.engines) ? r.engines[0] : r.engines)?.name ?? "unknown";
    if (!engineStats[engineName]) engineStats[engineName] = { total: 0, mentioned: 0 };
    engineStats[engineName].total += 1;
    if (r.brand_mentioned) engineStats[engineName].mentioned += 1;
  }

  const { data: competitors } = await supabase
    .from("competitors")
    .select("name")
    .eq("brand_id", brandId)
    .eq("confirmed", true);

  const competitorData = (competitors ?? []).map((c) => {
    let count = 0;
    for (const r of runs ?? []) {
      const mentions = (r.competitor_mentions ?? []) as { name: string; mentioned: boolean }[];
      if (mentions.find((m) => m.name.toLowerCase() === c.name.toLowerCase())?.mentioned) count += 1;
    }
    return { name: c.name, sharePercent: totalRuns > 0 ? Math.round((count / totalRuns) * 100) : 0 };
  });
  if (visibilityScore !== null) {
    competitorData.unshift({ name: `${brand.name} (you)`, sharePercent: visibilityScore });
  }

  const promptById = new Map((prompts ?? []).map((p) => [p.id, p]));
  const topPrompts = (runs ?? []).slice(0, 15).map((r) => ({
    text: promptById.get(r.prompt_id)?.text ?? "—",
    mentioned: r.brand_mentioned ?? false,
    sentiment: r.sentiment ?? "neutral",
  }));

  // ---------- Site Audit summary (latest persisted audit) ----------
  // From the site_audits table (migration 004). Only the four scalar scores +
  // the top non-pass issues are surfaced — the same honest data the dashboard
  // shows. Null when the brand has never run an audit.
  const { data: latestAudit } = await supabase
    .from("site_audits")
    .select("overall_score, schema_markup_score, crawlability_score, llms_txt_present, issues, run_at")
    .eq("brand_id", brandId)
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type AuditIssue = { check: string; status: "pass" | "warning" | "fail"; detail: string };
  const siteAudit = latestAudit
    ? {
        overallScore: latestAudit.overall_score ?? null,
        schemaScore: latestAudit.schema_markup_score ?? null,
        crawlabilityScore: latestAudit.crawlability_score ?? null,
        llmsTxtPresent: latestAudit.llms_txt_present ?? false,
        runAt: latestAudit.run_at
          ? new Date(latestAudit.run_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
          : null,
        topIssues: ((latestAudit.issues ?? []) as AuditIssue[])
          .filter((i) => i.status !== "pass")
          .slice(0, 8)
          .map((i) => ({ check: i.check, status: i.status, detail: i.detail })),
      }
    : null;

  // ---------- Citation landscape (persisted citations) ----------
  // From the citations table (schema.sql), joined via this brand's runs.
  // own-domain vs competitor-domain split + the most-cited domains.
  const runIds = (runs ?? []).map((r) => r.id).filter(Boolean);
  const { data: citations } = runIds.length
    ? await supabase
        .from("citations")
        .select("cited_domain, is_own_domain, is_competitor_domain")
        .in("run_id", runIds)
    : { data: [] };

  const citationRows = citations ?? [];
  const domainCounts = new Map<string, number>();
  let ownDomainCount = 0;
  let competitorDomainCount = 0;
  for (const c of citationRows) {
    if (c.is_own_domain) ownDomainCount += 1;
    if (c.is_competitor_domain) competitorDomainCount += 1;
    const d = (c.cited_domain ?? "").trim();
    if (d) domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }
  const citationSummary =
    citationRows.length > 0
      ? {
          total: citationRows.length,
          ownDomainCount,
          competitorDomainCount,
          topDomains: Array.from(domainCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([domain, count]) => ({ domain, count })),
        }
      : null;

  // ---------- Visibility Metrics (latest persisted snapshot) ----------
  // Sourced from geo_metric_snapshots (migration 012) so the report shows the
  // same normalized scores as the dashboard. Null until the nightly
  // metrics-snapshot cron has run at least once for this brand (honest: we
  // never estimate a missing snapshot).
  const snap = await getLatestSnapshot(brandId, "30d", supabase);
  const geoMetrics = snap
    ? {
        snapshotDate: snap.snapshot_date,
        visibility_rate: snap.metrics.visibility_rate,
        citation_rate: snap.metrics.citation_rate,
        citation_share: snap.metrics.citation_share,
        avg_rank: snap.metrics.avg_rank,
        model_divergence: snap.metrics.model_divergence,
        recommendation_quality: snap.metrics.recommendation_quality,
        trend_velocity: snap.metrics.trend_velocity,
        sentiment_score: snap.metrics.sentiment_score,
        per_engine: Object.entries(snap.per_engine).map(([name, m]) => ({ name, ...m })),
      }
    : null;

  const buffer = await renderToBuffer(
    ReportDocument({
      data: {
        brandName: brand.name,
        industry: brand.industry,
        generatedAt: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        visibilityScore,
        totalRuns,
        totalPrompts: prompts?.length ?? 0,
        engineBreakdown: Object.entries(engineStats).map(([engine, s]) => ({ engine, ...s })),
        topPrompts,
        competitors: competitorData,
        siteAudit,
        citations: citationSummary,
        geoMetrics,
      },
    })
  );

  return { buffer, brandName: brand.name };
}
