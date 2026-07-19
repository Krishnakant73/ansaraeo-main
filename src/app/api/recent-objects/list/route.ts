import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/recent-objects/list
// Returns { items: RecentObject[] } — the calling user's most recent
// objects across all orgs they belong to, capped at 10.
//
// Consumed by ObjectsRail on mount to hydrate its Recent list.
// ============================================================

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [] });

  const { data, error } = await supabase
    .from("recent_objects")
    .select("kind, ref_id, label, brand_id, viewed_at")
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
