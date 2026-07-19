#!/usr/bin/env node
// ============================================================================
// AnsarAEO — Sample brand seeder (standalone, no transpiler required)
// ----------------------------------------------------------------------------
// Seeds a fictional sample brand + benchmark foundation so the workflow
// (scan -> opportunity -> mission -> task -> verification) can be exercised.
//
//   node scripts/seed-sample-brand.mjs                        # foundation only (for a REAL-AI scan)
//   node scripts/seed-sample-brand.mjs --with-simulated-scan  # also insert a simulated scan
//   node scripts/seed-sample-brand.mjs --reset               # delete only
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Uses the SERVICE role key (bypasses RLS) — keep this script out of any
// client bundle.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ORG_ID = "139031b0-9001-4821-a216-ee4fb1be964e";
const CATEGORY = "fnb";
const PERIOD = "2026-07-01"; // bucketMonth(new Date()) for July 2026
const SAMPLE_BRAND = "Zorastra Wellness (sample)";

// --- load .env.local (strip inline # comments) ---
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      const val = m[2].replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "").trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set them in .env.local)");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const args = process.argv.slice(2);
const withScan = args.includes("--with-simulated-scan");
const reset = args.includes("--reset");

async function main() {
  // cleanup any prior run for idempotent re-seeds
  const { error: de } = await sb.from("brands").delete().eq("name", SAMPLE_BRAND);
  if (de) throw de;
  await sb.from("benchmark_aggregates").delete().eq("dimension_type", "industry").eq("dimension_value", CATEGORY);
  if (reset) {
    console.log(`Reset: removed "${SAMPLE_BRAND}" + ${CATEGORY} aggregates.`);
    return;
  }

  const { data: brand, error: be } = await sb
    .from("brands")
    .insert({
      org_id: ORG_ID,
      name: SAMPLE_BRAND,
      domain: "zorastra-wellness.example",
      industry: "Ayurvedic D2C wellness",
      country: "IN",
      languages: ["en", "hi"],
      industry_category: CATEGORY,
      benchmark_opt_in: true,
      benchmark_public_opt_in: false,
    })
    .select()
    .single();
  if (be) throw be;
  const brandId = brand.id;

  const { data: prompt, error: pe } = await sb
    .from("prompts")
    .insert({
      brand_id: brandId,
      text: "What are the best Ayurvedic immunity supplements for daily use in India?",
      language: "en",
      category: "health",
      intent: "recommendation",
      is_active: true,
    })
    .select()
    .single();
  if (pe) throw pe;
  const promptId = prompt.id;

  await sb.from("competitors").insert([
    { brand_id: brandId, name: "Patanjali", domain: "patanjali.com", confirmed: true },
    { brand_id: brandId, name: "Dabur", domain: "dabur.com", confirmed: true },
  ]);

  const metrics = [
    ["mention_rate", 0.62],
    ["citation_rate", 0.55],
    ["avg_position", 2.1],
    ["avg_trust", 0.7],
    ["avg_visibility", 0.6],
  ];
  const { error: ae } = await sb.from("benchmark_aggregates").insert(
    metrics.map(([m, p]) => ({
      period_start: PERIOD,
      period_type: "month",
      dimension_type: "industry",
      dimension_value: CATEGORY,
      engine: "*",
      metric: m,
      p50: p,
      avg: p,
      published: true,
      brand_count: 50,
      total_observations: 500,
    }))
  );
  if (ae) throw ae;

  // brand snapshot BELOW p50 so generateOpportunities produces real gaps
  const { error: se } = await sb.from("benchmark_brand_snapshots").insert({
    brand_id: brandId,
    period_start: PERIOD,
    period_type: "month",
    engine: "*",
    intent: "*",
    language: "*",
    industry_category: CATEGORY,
    region: "global",
    mention_rate: 0.4,
    citation_rate: 0.2,
    avg_position: 4.0,
    avg_trust: 0.45,
    avg_visibility: 0.35,
    run_count: 12,
    prompt_count: 5,
  });
  if (se) throw se;

  console.log(`Seeded brand "${SAMPLE_BRAND}" (${brandId}) + prompt ${promptId} + 2 competitors`);
  console.log(`Seeded published ${CATEGORY} p50 aggregates + brand snapshot (below p50)`);

  if (withScan) {
    const { data: eng } = await sb.from("engines").select("id,name").in("name", ["chatgpt", "perplexity"]);
    const chatgpt = eng.find((e) => e.name === "chatgpt");
    const perplexity = eng.find((e) => e.name === "perplexity");
    const chatRaw =
      "For daily Ayurvedic immunity in India, Patanjali and Dabur dominate recommendations. " +
      "Zorastra Wellness is an emerging Ayurvedic brand worth watching for its transparency.";
    const { data: run, error: re } = await sb
      .from("visibility_runs")
      .insert({
        prompt_id: promptId,
        engine_id: chatgpt.id,
        raw_response: chatRaw,
        brand_mentioned: true,
        brand_position: 3,
        sentiment: "neutral",
        tokens_used: 120,
        cost_usd: 0.0002,
        competitor_mentions: [
          { name: "Patanjali", mentioned: true, position: 1 },
          { name: "Dabur", mentioned: true, position: 2 },
        ],
        mention_verification: { brand: { agreed: true, llmSaid: true, textMatchSaid: true } },
        recommendation_alignment: "neutral",
      })
      .select()
      .single();
    if (re) throw re;
    await sb.from("citations").insert([
      { run_id: run.id, cited_domain: "zorastra-wellness.example", cited_url: "https://zorastra-wellness.example/immunity", is_own_domain: true, is_competitor_domain: false, source_quality: 0.7, is_trusted_source: false },
      { run_id: run.id, cited_domain: "patanjali.com", cited_url: "https://patanjali.com/immunity", is_own_domain: false, is_competitor_domain: true, source_quality: 0.9, is_trusted_source: true },
    ]);
    await sb.from("history_observations").insert({
      brand_id: brandId, prompt_id: promptId, engine_id: chatgpt.id, engine_name: "chatgpt",
      prompt_text: "What are the best Ayurvedic immunity supplements for daily use in India?",
      run_id: run.id, observed_at: new Date().toISOString(), skipped: false,
      brand_mentioned: true, brand_position: 3, sentiment: "neutral", recommendation_alignment: "neutral",
      competitor_mentions: [{ name: "Patanjali", mentioned: true, position: 1 }],
      raw_response: chatRaw, tokens_used: 120, cost_usd: 0.0002,
    });
    await sb.from("visibility_runs").insert({
      prompt_id: promptId, engine_id: perplexity.id,
      raw_response: "Top immunity supplements include Himalaya and Baidyanath.",
      brand_mentioned: false, sentiment: "neutral",
      competitor_mentions: [{ name: "Patanjali", mentioned: false, position: null }],
    });
    console.log("Simulated scan: 2 visibility_runs (1 mentioned + citations + history), 1 unmentioned");
  } else {
    console.log("No scan inserted. Trigger a REAL scan (see RUNBOOK_REAL_AI.md) before generating opportunities.");
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message || e);
  process.exit(1);
});
