import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";

// ============================================================
// POST /api/opportunities/skip
// Body: { opportunityId: string, brandId?: string, reason?: string }
//
// Persists an opportunity dismissal so it stops reappearing in Today's
// Mission across devices/sessions. Replaces the localStorage-only
// implementation the SkipMissionButton had in Phase 1.
//
// The dismissal is per-user-per-brand: two teammates can independently
// decide a mission is "not for them" without silencing it for the
// whole team. `reason` is optional free-form.
// ============================================================

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { opportunityId?: string; brandId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const opportunityId = String(body.opportunityId ?? "").trim();
  if (!opportunityId) return NextResponse.json({ error: "missing_opportunity_id" }, { status: 400 });

  // If the caller didn't specify a brandId, fall back to the currently
  // selected brand — the SkipMissionButton always fires from inside a
  // brand context so this is safe.
  let brandId = body.brandId?.trim() || null;
  if (!brandId) {
    const { brand } = await getSelectedBrand();
    brandId = brand?.id ?? null;
  }
  if (!brandId) return NextResponse.json({ error: "no_brand" }, { status: 400 });

  const { error } = await supabase
    .from("opportunity_dismissals")
    .upsert(
      {
        brand_id: brandId,
        user_id: user.id,
        opportunity_id: opportunityId,
        reason: body.reason ?? null,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,user_id,opportunity_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
