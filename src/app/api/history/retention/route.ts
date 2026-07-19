import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { isRetentionTier, type RetentionTier } from "@/lib/history-events";
import { invalidateHistoryCache } from "@/lib/history-cache";

// ============================================================
// GET|PUT /api/history/retention
// Reads / updates the selected brand's history_retention_tier.
//   30d       → prune observations/events older than 30 days (nightly)
//   365d      → prune older than 1 year
//   unlimited → keep everything forever (default)
// User-initiated writes go through the COOKIE client so RLS scopes the
// update to the org's own brand. The prune itself runs in the cron, not here.
// =============================================================

export async function GET() {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("history_retention_tier")
    .eq("id", brand.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tier: data?.history_retention_tier ?? "unlimited" });
}

export async function PUT(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tier = (body as { tier?: unknown })?.tier;
  if (typeof tier !== "string" || !isRetentionTier(tier)) {
    return NextResponse.json({ error: "tier must be one of 30d, 365d, unlimited" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .update({ history_retention_tier: tier as RetentionTier })
    .eq("id", brand.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateHistoryCache(brand.id);
  return NextResponse.json({ tier });
}
