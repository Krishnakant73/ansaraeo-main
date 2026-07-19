import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/share/report  { brandId }
//
// Authenticated route. Creates a 7-day share-view token for a brand
// the caller owns (RLS gates the insert). Returns the URL.
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { brandId?: unknown };
  const brandId = typeof body.brandId === "string" ? body.brandId : null;
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("share_view_tokens")
    .insert({ brand_id: brandId, created_by: user.id })
    .select("token")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create link" }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return NextResponse.json({ ok: true, url: `${origin}/share/report/${data.token}` });
}
