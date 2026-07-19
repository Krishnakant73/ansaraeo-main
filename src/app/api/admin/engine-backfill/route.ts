import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeEnginePersonality } from "@/lib/engine-personality";

// ============================================================
// POST /api/admin/engine-backfill
//
// Walks the last N days of visibility_runs (default 60) and
// upserts one engine_snapshots row per (engine, brand, day) plus
// a fresh engine_personalities row per (engine, brand). Same math
// as the nightly cron — this is the "seed history" path so new
// customers don't stare at empty Model-Changes tabs while the
// cron ramps up daily.
//
// Auth: shared CRON_SECRET bearer header, same as every cron in
// this repo. Idempotent — safe to re-run.
//
// Query params:
//   ?days=<int>   window to backfill (default 60, max 365)
//   ?brand=<uuid> restrict to a single brand (default all)
// ============================================================

type RunRow = {
  id: string;
  run_at: string;
  engine_id: string;
  prompt_id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
};

type CitationRow = {
  run_id: string;
  is_own_domain: boolean | null;
};

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? 60) | 0));
  const restrictBrand = url.searchParams.get("brand");

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const [enginesRes, brandsRes] = await Promise.all([
    supabase.from("engines").select("id, name, is_active").eq("is_active", true),
    restrictBrand
      ? supabase.from("brands").select("id").eq("id", restrictBrand)
      : supabase.from("brands").select("id"),
  ]);
  const engines = (enginesRes.data as { id: string; name: string }[] | null) ?? [];
  const brands = (brandsRes.data as { id: string }[] | null) ?? [];

  let snapshotsWritten = 0;
  let personalitiesWritten = 0;
  const perBrandStats: { brand_id: string; days_written: number; runs_seen: number }[] = [];

  for (const brand of brands) {
    const { data: prompts } = await supabase
      .from("prompts")
      .select("id")
      .eq("brand_id", brand.id)
      .limit(1000);
    const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
    if (promptIds.length === 0) {
      perBrandStats.push({ brand_id: brand.id, days_written: 0, runs_seen: 0 });
      continue;
    }

    // Pull every run in the window for this brand's prompts.
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id, run_at, engine_id, prompt_id, brand_mentioned, brand_position")
      .in("prompt_id", promptIds)
      .gte("run_at", cutoff)
      .order("run_at", { ascending: true });
    const runList = (runs as RunRow[] | null) ?? [];

    let citList: CitationRow[] = [];
    if (runList.length > 0) {
      const { data: cits } = await supabase
        .from("citations")
        .select("run_id, is_own_domain")
        .in(
          "run_id",
          runList.map((r) => r.id),
        );
      citList = (cits as CitationRow[] | null) ?? [];
    }
    const citsByRun = new Map<string, CitationRow[]>();
    for (const c of citList) {
      const bucket = citsByRun.get(c.run_id) ?? [];
      bucket.push(c);
      citsByRun.set(c.run_id, bucket);
    }

    // Bucket runs by (engine_id, day).
    type Bucket = {
      engine_id: string;
      captured_on: string;
      runs: RunRow[];
      citations: CitationRow[];
    };
    const buckets = new Map<string, Bucket>();
    for (const r of runList) {
      const captured_on = r.run_at.slice(0, 10);
      const key = `${r.engine_id}::${captured_on}`;
      const cur =
        buckets.get(key) ?? { engine_id: r.engine_id, captured_on, runs: [], citations: [] };
      cur.runs.push(r);
      cur.citations.push(...(citsByRun.get(r.id) ?? []));
      buckets.set(key, cur);
    }

    let daysWritten = 0;
    for (const b of buckets.values()) {
      const scored = b.runs.filter((r) => r.brand_mentioned !== null);
      let mention_rate: number | null = null;
      let avg_position: number | null = null;
      if (scored.length > 0) {
        const hits = scored.filter((r) => r.brand_mentioned === true);
        mention_rate = +((hits.length / scored.length) * 100).toFixed(2);
        const positions = hits
          .map((r) => r.brand_position)
          .filter((p): p is number => typeof p === "number" && p > 0);
        if (positions.length > 0) {
          avg_position = +(positions.reduce((a, x) => a + x, 0) / positions.length).toFixed(2);
        }
      }

      let citation_share: number | null = null;
      let own_citation_share: number | null = null;
      if (b.runs.length > 0) {
        if (b.citations.length > 0) {
          citation_share = +Math.min(100, (b.citations.length / b.runs.length / 5) * 100).toFixed(2);
          const own = b.citations.filter((c) => c.is_own_domain === true).length;
          own_citation_share = +((own / b.citations.length) * 100).toFixed(2);
        } else {
          citation_share = 0;
          own_citation_share = 0;
        }
      }

      const { error } = await supabase.from("engine_snapshots").upsert(
        {
          engine_id: b.engine_id,
          brand_id: brand.id,
          captured_on: b.captured_on,
          mention_rate,
          avg_position,
          citation_share,
          own_citation_share,
          runs_observed: b.runs.length,
        },
        { onConflict: "engine_id,brand_id,captured_on" },
      );
      if (!error) {
        snapshotsWritten += 1;
        daysWritten += 1;
      }
    }

    // Refresh personality cache for every engine that has ANY runs
    // for this brand in the window (not just today's window).
    const enginesTouched = new Set(runList.map((r) => r.engine_id));
    for (const engineId of enginesTouched) {
      const personality = await computeEnginePersonality(supabase, engineId, brand.id);
      if (personality.runs_observed === 0) continue;
      const { error } = await supabase.from("engine_personalities").upsert(
        {
          engine_id: engineId,
          brand_id: brand.id,
          verbosity: personality.verbosity,
          hedging: personality.hedging,
          format_bias: personality.format_bias,
          freshness_bias: personality.freshness_bias,
          citation_density: personality.citation_density,
          entity_resolution: personality.entity_resolution,
          sample_run_ids: personality.sample_run_ids,
          runs_observed: personality.runs_observed,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "engine_id,brand_id" },
      );
      if (!error) personalitiesWritten += 1;
    }

    perBrandStats.push({
      brand_id: brand.id,
      days_written: daysWritten,
      runs_seen: runList.length,
    });
  }

  return NextResponse.json({
    ok: true,
    days,
    brands: brands.length,
    engines: engines.length,
    snapshots_written: snapshotsWritten,
    personalities_written: personalitiesWritten,
    per_brand: perBrandStats,
  });
}
