import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// PATCH /api/tasks/[id] — update task fields.
// Cookie client + RLS. Whitelisted writable fields; status and type
// validated against the schema check constraints. Setting status to
// 'done' auto-fills completed_at if not provided.
// ============================================================

const ALLOWED_FIELDS = new Set([
  "title",
  "type",
  "status",
  "assignee_id",
  "due_date",
  "engine_action",
  "verification_result",
  "completed_at",
]);
const ALLOWED_STATUS = new Set([
  "backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled",
]);
const ALLOWED_TYPE = new Set(["fix", "content", "approve", "deploy", "verify"]);

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
    if (key === "type" && !ALLOWED_TYPE.has(String(value))) {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }
    update[key] = value;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no writable fields provided" }, { status: 400 });
  }

  // Auto-set completed_at when status → done and caller didn't provide one.
  if (update.status === "done" && !("completed_at" in update)) {
    update.completed_at = new Date().toISOString();
  }
  // Clear completed_at when reopening.
  if (update.status && update.status !== "done" && !("completed_at" in update)) {
    update.completed_at = null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
