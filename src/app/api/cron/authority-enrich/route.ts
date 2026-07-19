import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { enrichDomains } from "@/lib/domain-authority";

// ============================================================
// GET /api/cron/authority-enrich
//
// Incrementally backfills real domain authority (DataForSEO domain_rank) for
// cited domains and writes it onto citations. Bounded per run to stay within a
// sane DataForSEO credit budget. CRON_SECRET-protected. No-op when creds absent.
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const limitParam = Number(request.nextUrl.searchParams.get("limit")) || 50;
  const result = await enrichDomains(supabase, { limit: limitParam });

  return NextResponse.json({ success: true, ...result });
}
