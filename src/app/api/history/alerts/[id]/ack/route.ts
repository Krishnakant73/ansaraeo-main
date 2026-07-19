import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { invalidateHistoryCache } from "@/lib/history-cache";

// ============================================================
// PUT /api/history/alerts/[id]/ack
// Acknowledge a history alert. Writes through the COOKIE client so RLS
// scopes the update to the org's own brand (a user can only ack their own
// alerts). After success the cache for that brand is invalidated so the
// unacknowledged count refreshes immediately.
// =============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Alert id required" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("history_alerts")
    .update({ acknowledged: true })
    .eq("id", id)
    .eq("brand_id", brand.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateHistoryCache(brand.id);
  return NextResponse.json({ success: true, id });
}
