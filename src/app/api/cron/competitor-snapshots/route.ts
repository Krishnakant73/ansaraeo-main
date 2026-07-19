import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/cron/competitor-snapshots
//
// Daily rollup: writes one competitor_snapshots row per competitor
// for the day. Uses the service client (RLS-bypass) since the cron
// runs unauthenticated. Auth is the shared CRON_SECRET bearer
// header — same pattern as every other cron in this repo.
//
// The rollup window is the last 24 hours of visibility_runs. Empty
// windows still get a row (all metrics null) so the UI can tell
// "we checked yesterday, nothing happened" apart from "the cron
// hasn't run".
// ============================================================

type Row = {
  run_at: string;
  brand_mentioned: boolean | null;
  competitor_mentions:
    | { name: string; mentioned: boolean; position: number | null }[]
    | null;
};

type CitationRow = {
  run_id: string;
  is_own_domain: boolean | null;
  is_competitor_domain: boolean | null;
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

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, brand_id, name")
    .eq("confirmed", true);
  const compList =
    (competitors as { id: string; brand_id: string; name: string }[] | null) ?? [];

  let written = 0;
  for (const c of compList) {
    const { data: prompts } = await supabase
      .from("prompts")
      .select("id")
      .eq("brand_id", c.brand_id)
      .limit(500);
    const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

    let mentionRate: number | null = null;
    let brandRate: number | null = null;
    let avgPos: number | null = null;
    let citationCount = 0;
    let runsObserved = 0;

    if (promptIds.length > 0) {
      const { data: runs } = await supabase
        .from("visibility_runs")
        .select("id, run_at, brand_mentioned, competitor_mentions")
        .in("prompt_id", promptIds)
        .gte("run_at", dayAgo);
      const rows = (runs as (Row & { id: string })[] | null) ?? [];
      runsObserved = rows.length;

      const nameLower = c.name.toLowerCase();
      const scored = rows.filter((r) => r.brand_mentioned !== null);
      if (scored.length > 0) {
        const themHits = scored.filter((r) =>
          (r.competitor_mentions ?? []).some(
            (m) => m.mentioned && m.name.toLowerCase() === nameLower,
          ),
        );
        const youHits = scored.filter((r) => r.brand_mentioned === true);
        mentionRate = +((themHits.length / scored.length) * 100).toFixed(2);
        brandRate = +((youHits.length / scored.length) * 100).toFixed(2);

        const positions = themHits
          .map((r) =>
            (r.competitor_mentions ?? []).find(
              (m) => m.mentioned && m.name.toLowerCase() === nameLower,
            )?.position,
          )
          .filter((p): p is number => typeof p === "number" && p > 0);
        if (positions.length > 0) {
          avgPos = +(positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(2);
        }
      }

      if (rows.length > 0) {
        const { data: cits } = await supabase
          .from("citations")
          .select("run_id, is_own_domain, is_competitor_domain")
          .in(
            "run_id",
            rows.map((r) => r.id),
          );
        citationCount = ((cits as CitationRow[] | null) ?? []).filter(
          (c) => c.is_competitor_domain,
        ).length;
      }
    }

    const gap_pp =
      mentionRate != null && brandRate != null
        ? +(mentionRate - brandRate).toFixed(2)
        : null;

    // Upsert on the (competitor_id, captured_on) unique key.
    const { error } = await supabase.from("competitor_snapshots").upsert(
      {
        competitor_id: c.id,
        captured_on,
        mention_rate: mentionRate,
        brand_mention_rate: brandRate,
        gap_pp,
        avg_position: avgPos,
        citation_count: citationCount,
        runs_observed: runsObserved,
      },
      { onConflict: "competitor_id,captured_on" },
    );
    if (!error) written += 1;
  }

  return NextResponse.json({
    ok: true,
    captured_on,
    competitors: compList.length,
    written,
  });
}
