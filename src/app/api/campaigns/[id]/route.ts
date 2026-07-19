import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// PATCH /api/campaigns/[id] — update campaign fields.
// Cookie client → RLS ensures the caller can only patch campaigns in
// their own org's brands. Whitelist of writable fields keeps this
// endpoint tight. Used by the Campaign workspace's quick actions
// (status transitions).
// ============================================================

const ALLOWED_FIELDS = new Set(["name", "objective", "status"]);
const ALLOWED_STATUS = new Set(["active", "paused", "completed"]);

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
    if (key === "status" && !ALLOWED_STATUS.has(String(value))) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update[key] = value;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no writable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
