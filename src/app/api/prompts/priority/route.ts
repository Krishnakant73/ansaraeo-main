import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/prompts/priority — toggle a prompt's "money prompt" flag.
// Body: { promptId: string, priority: boolean }
// RLS scopes the update to prompts the user owns; a no-op update returns 404.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { promptId, priority } = await request.json();
  if (!promptId) return NextResponse.json({ error: "promptId is required" }, { status: 400 });

  const { error } = await supabase
    .from("prompts")
    .update({ priority: Boolean(priority) })
    .eq("id", promptId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Verify the row existed (RLS-scoped) and the update actually touched it.
  const { count, error: countError } = await supabase
    .from("prompts")
    .select("*", { count: "exact", head: true })
    .eq("id", promptId);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Prompt not found or not owned" }, { status: 404 });

  return NextResponse.json({ success: true, priority: Boolean(priority) });
}
