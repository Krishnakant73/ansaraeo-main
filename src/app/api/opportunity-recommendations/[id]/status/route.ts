import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/opportunity-recommendations/[id]/status
// Body: { status: "open" | "in_progress" | "snoozed" | "done" | "dismissed" }
//
// Move an opportunity between Battle Plan lanes. RLS scopes access.
// Called from the client-side drag-and-drop in the Battle Plan tab.
// ============================================================

const ALLOWED = new Set(["open", "in_progress", "snoozed", "done", "dismissed"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const status = String(body.status ?? "").trim();
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("opportunity_recommendations")
    .update({ status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
