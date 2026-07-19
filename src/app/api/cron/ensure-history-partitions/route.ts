import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/cron/ensure-history-partitions
//
// Idempotently creates any missing monthly partitions for the history
// tables (current month + next 3). Called monthly (and harmlessly daily)
// so a visibility run never lands in a month with no partition — which
// would otherwise fail the INSERT (caught + reported, but the observation
// would be lost). Protected by CRON_SECRET.
// =============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.rpc("ensure_history_partitions");
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, partitionsEnsured: true });
}
