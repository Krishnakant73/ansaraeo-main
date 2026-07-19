import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// PATCH /api/playbooks/[id] — update playbook fields.
// Cookie client + RLS. Whitelisted writable fields.
// ============================================================

const ALLOWED_FIELDS = new Set([
  "name",
  "description",
  "trigger_type",
  "steps",
  "is_active",
]);
const ALLOWED_TRIGGERS = new Set(["opportunity_type", "engine", "manual"]);

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
    if (key === "trigger_type" && !ALLOWED_TRIGGERS.has(String(value))) {
      return NextResponse.json({ error: "invalid trigger_type" }, { status: 400 });
    }
    if (key === "steps" && !Array.isArray(value)) {
      return NextResponse.json({ error: "steps must be an array" }, { status: 400 });
    }
    if (key === "name") {
      const s = typeof value === "string" ? value.trim() : "";
      if (!s) return NextResponse.json({ error: "name required" }, { status: 400 });
      update[key] = s;
      continue;
    }
    update[key] = value;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no writable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("playbooks")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
