import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// PATCH /api/alerts/rule/[id] — update a geo_alert_rules row.
// Cookie client + RLS. Whitelisted fields only; the alert workspace
// uses this to toggle is_active. Full rule edits still route through
// /api/alerts/rule (POST for create, DELETE for delete).
// ============================================================

const ALLOWED_FIELDS = new Set(["is_active", "threshold", "window_type", "direction", "mode"]);
const ALLOWED_DIRECTION = new Set(["up", "down"]);
const ALLOWED_MODE = new Set(["delta", "level"]);
const ALLOWED_WINDOW = new Set(["7d", "30d"]);

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (key === "direction" && !ALLOWED_DIRECTION.has(String(value))) {
      return NextResponse.json({ error: "invalid direction" }, { status: 400 });
    }
    if (key === "mode" && !ALLOWED_MODE.has(String(value))) {
      return NextResponse.json({ error: "invalid mode" }, { status: 400 });
    }
    if (key === "window_type" && !ALLOWED_WINDOW.has(String(value))) {
      return NextResponse.json({ error: "invalid window_type" }, { status: 400 });
    }
    update[key] = value;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no writable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("geo_alert_rules")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
