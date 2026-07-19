import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAlertRule, listAlertRules, deleteAlertRule, VALID_METRICS, type AlertMetric } from "@/lib/alerts";

// GET /api/alerts/rule?brandId= — list a brand's alert rules
// POST /api/alerts/rule — create a rule { brandId, metric, window, direction, threshold, mode? }
// DELETE /api/alerts/rule — delete { ruleId, brandId }
// Cookie/RLS client — user-scoped.

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

  const rules = await listAlertRules(supabase, brandId);
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { brandId, metric, window, direction, threshold, mode } = body;
  if (!brandId || !metric || !window || !direction || typeof threshold !== "number") {
    return NextResponse.json({ error: "brandId, metric, window, direction, threshold are required" }, { status: 400 });
  }
  if (!VALID_METRICS.includes(metric as AlertMetric)) {
    return NextResponse.json({ error: "Unknown metric" }, { status: 400 });
  }
  if (!["7d", "30d"].includes(window) || !["up", "down"].includes(direction)) {
    return NextResponse.json({ error: "Invalid window or direction" }, { status: 400 });
  }
  if (mode && !["delta", "level"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const rule = await createAlertRule(supabase, {
    brand_id: brandId,
    metric: metric as AlertMetric,
    window,
    direction,
    mode,
    threshold,
  });
  return NextResponse.json({ success: true, rule });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { ruleId, brandId } = await request.json();
  if (!ruleId || !brandId) return NextResponse.json({ error: "ruleId and brandId are required" }, { status: 400 });

  await deleteAlertRule(supabase, ruleId, brandId);
  return NextResponse.json({ success: true });
}
