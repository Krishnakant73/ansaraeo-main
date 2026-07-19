import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runVisibilityCheck } from "@/lib/visibility-engine";

// ============================================================
// GET /api/cron/nightly-runs
//
// Runs once daily (see vercel.json) — loops through all prompts across
// all brands and fires a visibility check for each one. This is what
// keeps the trend charts and visibility scores up-to-date automatically,
// even when no one is manually clicking "Run check" in the dashboard.
//
// Protected by CRON_SECRET: Vercel automatically passes this header
// for cron invocations; anyone else gets a 401.
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, brand_id")
    .order("created_at", { ascending: true });

  if (!prompts || prompts.length === 0) {
    return NextResponse.json({ success: true, checked: 0 });
  }

  const results: { promptId: string; success: boolean; error?: string }[] = [];

  for (const prompt of prompts) {
    try {
      await runVisibilityCheck(prompt.id);
      results.push({ promptId: prompt.id, success: true });
    } catch (err) {
      results.push({
        promptId: prompt.id,
        success: false,
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return NextResponse.json({
    success: true,
    checked: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
