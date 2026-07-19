import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// PATCH /api/content-items/[id]
// Update draft fields on a content_items row. Cookie client + RLS.
// Whitelisted writable fields; approval status is deliberately NOT
// settable here — approvals go through /api/content/approve so the
// E-E-A-T gate runs. This endpoint permits draft ↔ in_review ↔
// published transitions but blocks moves to "approved".
// ============================================================

const ALLOWED_FIELDS = new Set([
  "title",
  "content_markdown",
  "target_engine",
  "eeat_checklist",
  "status",
]);
const ALLOWED_STATUS_VIA_PATCH = new Set(["draft", "in_review", "published"]);

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
    if (key === "status" && !ALLOWED_STATUS_VIA_PATCH.has(String(value))) {
      return NextResponse.json(
        { error: "Approving requires /api/content/approve (E-E-A-T gate)." },
        { status: 400 },
      );
    }
    update[key] = value;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no writable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("content_items")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
