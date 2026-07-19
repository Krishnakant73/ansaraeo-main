import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { createServiceClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/history/export
// Stream a CSV of the brand's real history (observations or events) for a
// window. Brand-scoped via the auth cookie; the query uses the service client
// but is filtered by brand_id. Not cached (export should always reflect the
// latest data). Honesty: only real rows are returned; raw_response is omitted
// to keep files sane; jsonb fields are exported as compact JSON strings.
// =============================================================

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Escape quotes, commas, newlines per RFC 4180.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.map(csvCell).join(",");
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") === "events" ? "events" : "observations";
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const engine = searchParams.get("engine") ?? undefined;

  const supabase = createServiceClient();
  let csv: string;
  let filename: string;

  if (type === "events") {
    let q = supabase
      .from("history_events")
      .select("occurred_at, engine_name, event_type, severity, prompt_id, detail, prior_observation_id, observation_id")
      .eq("brand_id", brand.id)
      .order("occurred_at", { ascending: false });
    if (from) q = q.gte("occurred_at", from);
    if (to) q = q.lte("occurred_at", to);
    if (engine) q = q.eq("engine_name", engine);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = ["occurred_at", "engine_name", "event_type", "severity", "prompt_id", "detail", "prior_observation_id", "observation_id"];
    csv = toCsv(
      headers,
      (data ?? []).map((r: any) => [r.occurred_at, r.engine_name, r.event_type, r.severity, r.prompt_id, r.detail, r.prior_observation_id, r.observation_id]),
    );
    filename = `history-events-${brand.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    let q = supabase
      .from("history_observations")
      .select("observed_at, engine_name, prompt_text, brand_mentioned, brand_position, sentiment, recommendation_alignment, skipped, skip_reason, competitor_mentions, mention_verification")
      .eq("brand_id", brand.id)
      .order("observed_at", { ascending: false });
    if (from) q = q.gte("observed_at", from);
    if (to) q = q.lte("observed_at", to);
    if (engine) q = q.eq("engine_name", engine);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = ["observed_at", "engine_name", "prompt_text", "brand_mentioned", "brand_position", "sentiment", "recommendation_alignment", "skipped", "skip_reason", "competitor_mentions", "mention_verification"];
    csv = toCsv(
      headers,
      (data ?? []).map((r: any) => [
        r.observed_at, r.engine_name, r.prompt_text, r.brand_mentioned, r.brand_position, r.sentiment,
        r.recommendation_alignment, r.skipped, r.skip_reason, r.competitor_mentions, r.mention_verification,
      ]),
    );
    filename = `history-observations-${brand.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
