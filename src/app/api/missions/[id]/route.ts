import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// PATCH /api/missions/[id] — update mission fields.
// Cookie client + RLS. Whitelisted writable fields; status validated
// against the schema check constraint.
// ============================================================

const ALLOWED_FIELDS = new Set([
  "title",
  "objective",
  "status",
  "priority",
  "owner_id",
  "due_date",
  "linked_campaign_id",
  "linked_sprint_id",
]);
const ALLOWED_STATUS = new Set(["active", "on_hold", "completed", "cancelled"]);

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
    if (key === "priority") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return NextResponse.json({ error: "priority must be 1..5" }, { status: 400 });
      }
      update[key] = n;
      continue;
    }
    update[key] = value;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no writable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("missions")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
