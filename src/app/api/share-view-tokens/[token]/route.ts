import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// PATCH /api/share-view-tokens/[token] — revoke a share link.
// Cookie client + RLS. Only `revoked` is settable — expiry is
// fixed at creation time, and re-issuing a link means creating a
// fresh row (which lives under a different POST route).
// ============================================================

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.revoked !== "boolean") {
    return NextResponse.json({ error: "revoked (boolean) required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("share_view_tokens")
    .update({ revoked: body.revoked })
    .eq("token", token)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
