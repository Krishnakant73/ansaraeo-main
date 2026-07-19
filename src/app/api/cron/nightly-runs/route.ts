import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/platform/queue";

// ============================================================
// GET /api/cron/nightly-runs  (gated by CRON_SECRET, see vercel.json)
//
// Now a TRIGGER only: it enqueues one visibility_check job per active prompt
// (scoped to each prompt's org). The actual work runs in /api/worker/drain,
// which is invoked by its own cron. This keeps the nightly trigger fast and
// makes runs durable + parallel (the queue is the execution substrate).
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();
  const { data: prompts } = await sb
    .from("prompts")
    .select("id, brand_id")
    .eq("is_active", true);

  let enqueued = 0;
  let skipped = 0;
  for (const p of prompts ?? []) {
    const { data: brand } = await sb
      .from("brands")
      .select("org_id")
      .eq("id", p.brand_id)
      .maybeSingle();
    if (!brand?.org_id) {
      skipped++;
      continue;
    }
    await enqueueJob("visibility_check", { promptId: p.id }, { tenantId: brand.org_id });
    enqueued++;
  }

  return NextResponse.json({ success: true, enqueued, skipped });
}
