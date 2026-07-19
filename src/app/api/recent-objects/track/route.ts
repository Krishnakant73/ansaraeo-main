import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/recent-objects/track
// Body: { kind: string, ref_id: string, label?: string, brand_id?: string }
//
// Server-back the ObjectsRail "Recent" list. Called from
// <RecentObjectsTracker> on pathname changes inside /dashboard/**.
// Upserts on (user_id, kind, ref_id), bumping viewed_at.
//
// RLS enforces user_id = auth.uid() so a compromised client can't
// write for someone else.
// ============================================================

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: {
    kind?: string;
    ref_id?: string;
    label?: string;
    brand_id?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const kind = String(body.kind ?? "").trim();
  const ref_id = String(body.ref_id ?? "").trim();
  if (!kind || !ref_id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  // Resolve the user's org_id via org_members (RLS-safe — the cookie
  // client will filter this to their memberships).
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "no_org" }, { status: 400 });

  const { error } = await supabase
    .from("recent_objects")
    .upsert(
      {
        org_id: membership.org_id,
        user_id: user.id,
        kind,
        ref_id,
        label: body.label ?? null,
        brand_id: body.brand_id ?? null,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,kind,ref_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
