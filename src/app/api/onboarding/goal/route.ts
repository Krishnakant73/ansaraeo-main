import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivationEvent } from "@/lib/activation-events";

// ============================================================
// POST /api/onboarding/goal  { brandId, goal }
//
// Persists the goal on the brand row (RLS ensures the user actually
// owns the brand) and records an activation event for funnel tracking.
// ============================================================

const VALID_GOALS = new Set(["chatgpt_mentions", "beat_competitor", "fix_site"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { brandId?: unknown; goal?: unknown };
  const brandId = typeof body.brandId === "string" ? body.brandId : null;
  const goal = typeof body.goal === "string" ? body.goal : null;

  if (!brandId || !goal || !VALID_GOALS.has(goal)) {
    return NextResponse.json({ error: "brandId and a valid goal are required" }, { status: 400 });
  }

  // RLS scopes this to brands the user's org owns.
  const { error } = await supabase.from("brands").update({ onboarding_goal: goal }).eq("id", brandId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivationEvent({
    event: "goal_picked",
    userId: user.id,
    brandId,
    payload: { goal },
  });

  return NextResponse.json({ ok: true });
}
