import { NextRequest, NextResponse } from "next/server";
import { pruneByRetention } from "@/lib/history-engine";

// ============================================================
// GET /api/cron/history-prune
//
// The ONLY delete path in the History Database. For every brand on a
// 30d / 365d retention tier, deletes observations + events older than the
// tier cutoff. "unlimited" brands are skipped (keep forever). Honors the
// contract: data expires per the tier the customer chose. Protected by
// CRON_SECRET.
// =============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pruneByRetention();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
