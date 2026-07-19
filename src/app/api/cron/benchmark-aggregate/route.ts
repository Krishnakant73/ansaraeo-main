import { NextRequest, NextResponse } from "next/server";
import { safeAggregateBenchmarks } from "@/lib/benchmark-engine";
import { bucketMonth } from "@/lib/benchmark-metrics";

// ============================================================
// GET /api/cron/benchmark-aggregate
//
// Daily (right after benchmark-snapshot). Rolls up all opt-in brands'
// snapshots for the current month AND the just-finished prior month into
// anonymous, k-anonymity-gated benchmark_aggregates cells. Below K distinct
// brands a cell is stored but `published = false` (honest "not enough data").
//
// Protected by CRON_SECRET (Bearer header).
// ============================================================

function previousMonth(periodStart: string): string {
  const [y, m] = periodStart.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = bucketMonth(new Date());
  const prior = previousMonth(period);

  const out: Record<string, unknown> = { success: true, periods: [period, prior] };

  for (const p of [period, prior]) {
    try {
      const res = await safeAggregateBenchmarks(p);
      out[p] = res;
    } catch (err) {
      out[p] = { error: err instanceof Error ? err.message : "unknown error" };
    }
  }

  return NextResponse.json(out);
}
