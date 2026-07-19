import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeEnginePersonality } from "@/lib/engine-personality";

// ============================================================
// GET /api/cron/engine-snapshots
//
// Daily rollup: writes one engine_snapshots row per (engine, brand)
// pair AND refreshes the engine_personalities cache for the same
// pairs. Uses the service client (RLS bypass) since the cron runs
// unauthenticated. Auth is the shared CRON_SECRET bearer header —
// same pattern as every other cron in this repo.
//
// The rollup window is the last 24 hours of visibility_runs. Empty
// windows still get a row (metrics null / runs_observed=0) so the UI
// can tell "we checked yesterday, nothing happened" apart from "the
// cron hasn't run".
// ============================================================

type RunRow = {
  id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
};

type CitationRow = {
  is_own_domain: boolean | null;
};

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date();
  const captured_on = today.toISOString().slice(0, 10);
  const dayAgo = new Date(today.getTime() - 24 * 3600 * 1000).toISOString();

  const [enginesRes, brandsRes] = await Promise.all([
    supabase.from("engines").select("id, name").eq("is_active", true),
    supabase.from("brands").select("id"),
  ]);
  const engines = (enginesRes.data as { id: string; name: string }[] | null) ?? [];
  const brands = (brandsRes.data as { id: string }[] | null) ?? [];

  let snapshotsWritten = 0;
  let personalitiesWritten = 0;

  for (const brand of brands) {
    const { data: prompts } = await supabase
      .from("prompts")
      .select("id")
      .eq("brand_id", brand.id)
      .limit(500);
    const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
    if (promptIds.length === 0) continue;

    for (const engine of engines) {
      // ── Snapshot for the last 24h window ─────────────────────
      const { data: runs } = await supabase
        .from("visibility_runs")
        .select("id, brand_mentioned, brand_position")
        .eq("engine_id", engine.id)
        .in("prompt_id", promptIds)
        .gte("run_at", dayAgo);
      const rows = (runs as RunRow[] | null) ?? [];

      let mention_rate: number | null = null;
      let avg_position: number | null = null;
      let citation_share: number | null = null;
      let own_citation_share: number | null = null;

      const scored = rows.filter((r) => r.brand_mentioned !== null);
      if (scored.length > 0) {
        const hits = scored.filter((r) => r.brand_mentioned === true);
        mention_rate = +((hits.length / scored.length) * 100).toFixed(2);

        const positions = hits
          .map((r) => r.brand_position)
          .filter((p): p is number => typeof p === "number" && p > 0);
        if (positions.length > 0) {
          avg_position = +(positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(2);
        }
      }

      if (rows.length > 0) {
        const { data: cits } = await supabase
          .from("citations")
          .select("is_own_domain")
          .in(
            "run_id",
            rows.map((r) => r.id),
          );
        const c = (cits as CitationRow[] | null) ?? [];
        if (c.length > 0) {
          // Citations per run scaled to 0..100 with a 5-per-run cap.
          citation_share = +Math.min(100, (c.length / rows.length / 5) * 100).toFixed(2);
          const own = c.filter((x) => x.is_own_domain === true).length;
          own_citation_share = +((own / c.length) * 100).toFixed(2);
        } else {
          citation_share = 0;
          own_citation_share = 0;
        }
      }

      const { error: snapshotErr } = await supabase.from("engine_snapshots").upsert(
        {
          engine_id: engine.id,
          brand_id: brand.id,
          captured_on,
          mention_rate,
          avg_position,
          citation_share,
          own_citation_share,
          runs_observed: rows.length,
        },
        { onConflict: "engine_id,brand_id,captured_on" },
      );
      if (!snapshotErr) snapshotsWritten += 1;

      // ── Personality cache refresh ─────────────────────────────
      // Uses the last 500 runs (not the 24h window) — personality is
      // a long-window signal, so refreshing daily on a fixed lookback
      // gives a stable trailing view.
      const personality = await computeEnginePersonality(supabase, engine.id, brand.id);
      if (personality.runs_observed === 0) continue;
      const { error: personalityErr } = await supabase.from("engine_personalities").upsert(
        {
          engine_id: engine.id,
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
      if (!personalityErr) personalitiesWritten += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    captured_on,
    brands: brands.length,
    engines: engines.length,
    snapshots_written: snapshotsWritten,
    personalities_written: personalitiesWritten,
  });
}
