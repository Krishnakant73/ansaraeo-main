import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// PATCH /api/approvals/[id] — approve/reject an approval.
// Cookie client + RLS. Whitelisted fields; status validated. When
// status transitions from pending → approved|rejected we set
// decided_by (auth.uid()) and decided_at (now) atomically.
// ============================================================

const ALLOWED_FIELDS = new Set(["status", "note"]);
const ALLOWED_STATUS = new Set(["pending", "approved", "rejected"]);

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

  // When deciding, stamp decided_by + decided_at automatically.
  if (update.status && update.status !== "pending") {
    if (!("decided_by" in update)) update.decided_by = user.id;
    if (!("decided_at" in update)) update.decided_at = new Date().toISOString();
  }
  // When re-opening (pending after rejection), clear the decision fields.
  if (update.status === "pending") {
    update.decided_by = null;
    update.decided_at = null;
  }

  const { data, error } = await supabase
    .from("approvals")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
