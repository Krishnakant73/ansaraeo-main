// ============================================================
// scan-hydrate — turn an anonymous `public_scans` row into a real
// brand + competitors + prompts + visibility_runs so Mission Control
// opens populated the moment the user finishes signup.
//
// Called from src/app/auth/callback/route.ts after a successful
// exchangeCodeForSession, when a `pending_scan_id` cookie is present.
//
// Uses createServiceClient() because at callback time the session
// cookie may not yet be readable by RLS-scoped queries; we need to
// write rows on behalf of the just-signed-up user across `brands`,
// `competitors`, `prompts`, `visibility_runs`, `citations`, and
// `activation_events`. All writes are scoped to org_id derived from
// org_members, so RLS invariants remain intact even though the write
// itself bypasses RLS.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import type { ScanEngineResult, ScanReport } from "@/lib/scan-classifier";
import { logActivationEvent } from "@/lib/activation-events";

type PublicScanRow = {
  id: string;
  domain: string;
  canonical_domain: string;
  autofill_json: {
    companyName?: string;
    shortDescription?: string;
    suggestedCategory?: string;
    suggestedCompetitors?: string[];
    confidence?: "high" | "low";
  } | null;
  prompts_json: { text: string; language: string; intent: string }[] | null;
  engine_results_json: ScanEngineResult[] | null;
  report_json: ScanReport | null;
  claimed_by_user_id: string | null;
  claimed_brand_id: string | null;
};

export type HydrateResult =
  | { ok: true; brandId: string; alreadyClaimed: boolean }
  | { ok: false; error: string };

export async function hydrateScanIntoBrand(params: {
  userId: string;
  scanId: string;
}): Promise<HydrateResult> {
  const sb = createServiceClient();

  const { data: scan, error: scanErr } = await sb
    .from("public_scans")
    .select(
      "id, domain, canonical_domain, autofill_json, prompts_json, engine_results_json, report_json, claimed_by_user_id, claimed_brand_id",
    )
    .eq("id", params.scanId)
    .single<PublicScanRow>();

  if (scanErr || !scan) {
    return { ok: false, error: `scan not found: ${scanErr?.message ?? "no row"}` };
  }

  // If already claimed by this user, return the existing brand id (idempotent).
  if (scan.claimed_by_user_id === params.userId && scan.claimed_brand_id) {
    return { ok: true, brandId: scan.claimed_brand_id, alreadyClaimed: true };
  }
  // If claimed by a different user, don't overwrite — just return an error;
  // the caller will fall through to the ordinary onboarding path.
  if (scan.claimed_by_user_id && scan.claimed_by_user_id !== params.userId) {
    return { ok: false, error: "scan already claimed by another user" };
  }

  // Resolve org.
  const { data: membership } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", params.userId)
    .limit(1)
    .single();

  if (!membership) {
    return { ok: false, error: "no org for user (handle_new_user trigger may have failed)" };
  }

  const brandName =
    scan.autofill_json?.companyName?.trim() ||
    scan.canonical_domain.split(".")[0].replace(/[-_]/g, " ") ||
    scan.canonical_domain;

  const industry = scan.autofill_json?.suggestedCategory ?? null;

  // 1. Brand
  const { data: brand, error: brandErr } = await sb
    .from("brands")
    .insert({
      org_id: membership.org_id,
      name: brandName,
      domain: scan.canonical_domain,
      industry,
      languages: ["en"],
    })
    .select("id")
    .single();

  if (brandErr || !brand) {
    return { ok: false, error: `brand insert failed: ${brandErr?.message ?? "no row"}` };
  }

  // 2. Competitors (from autofill only — confirmed=false so the user can review)
  const competitorNames = scan.autofill_json?.suggestedCompetitors ?? [];
  if (competitorNames.length > 0) {
    await sb.from("competitors").insert(
      competitorNames.slice(0, 8).map((name) => ({
        brand_id: brand.id,
        name,
        // Left unconfirmed so the user reviews in Competitors before nightly cron picks up.
      })),
    );
  }

  // 3. Prompts — insert every scan prompt so the nightly cron picks them up.
  const promptRows = (scan.prompts_json ?? []).map((p) => ({
    brand_id: brand.id,
    text: p.text,
    language: p.language,
    intent: p.intent,
    is_active: true,
  }));
  const { data: promptsInserted } = promptRows.length
    ? await sb.from("prompts").insert(promptRows).select("id, text")
    : { data: null };

  // Map from prompt text -> newly-inserted prompt row id (for run backfill).
  const promptIdByText = new Map<string, string>();
  for (const p of promptsInserted ?? []) promptIdByText.set(p.text, p.id);

  // 4. Engines lookup (we only stored results for chatgpt/perplexity/gemini).
  const { data: engineRows } = await sb.from("engines").select("id, name").eq("is_active", true);
  const engineIdByName = new Map<string, string>((engineRows ?? []).map((e) => [e.name, e.id]));

  // 5. Backfill visibility_runs from cached engine_results_json.
  const runRows: {
    prompt_id: string;
    engine_id: string;
    raw_response: string;
    brand_mentioned: boolean;
    brand_position: number | null;
    sentiment: string;
    competitor_mentions: unknown;
    recommendation_alignment: string;
    mention_verification: unknown;
  }[] = [];

  for (const r of scan.engine_results_json ?? []) {
    if (!r.classified || r.skipped) continue;
    const promptId = promptIdByText.get(r.prompt);
    const engineId = engineIdByName.get(r.engine);
    if (!promptId || !engineId) continue;
    runRows.push({
      prompt_id: promptId,
      engine_id: engineId,
      raw_response: r.content ?? "",
      brand_mentioned: r.classified.brand_mentioned,
      brand_position: r.classified.brand_position,
      sentiment: r.classified.sentiment,
      competitor_mentions: r.classified.competitor_mentions,
      recommendation_alignment: r.classified.recommendation_alignment,
      mention_verification: r.classified.mention_verification,
    });
  }

  if (runRows.length > 0) {
    // We don't need the returned rows for anything downstream in this pass —
    // citations can be added in a follow-up (the free scan doesn't extract
    // cited URLs per-answer today, so there are none to backfill).
    await sb.from("visibility_runs").insert(runRows);
  }

  // 6. Claim the scan so a second callback doesn't re-hydrate.
  await sb
    .from("public_scans")
    .update({ claimed_by_user_id: params.userId, claimed_brand_id: brand.id })
    .eq("id", scan.id);

  // 7. Instrument.
  await Promise.all([
    logActivationEvent({
      event: "signup",
      userId: params.userId,
      brandId: brand.id,
      payload: { via: "scan_hydration", scanId: scan.id, domain: scan.canonical_domain },
    }),
    logActivationEvent({
      event: "scan_hydrated",
      userId: params.userId,
      brandId: brand.id,
      payload: {
        scanId: scan.id,
        promptsInserted: promptRows.length,
        competitorsInserted: competitorNames.length,
        runsBackfilled: runRows.length,
      },
    }),
  ]);

  return { ok: true, brandId: brand.id, alreadyClaimed: false };
}
