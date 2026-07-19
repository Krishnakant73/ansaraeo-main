// ============================================================
// GET /api/readiness?module=<key>&brandId=<optional>
//
// Returns a module's DataReadinessState as JSON. This is the single
// integration seam for ANY current or future module (server or client):
// call this, and if `state.status` is not READY/HIGH_CONFIDENCE, render
// <DataReadinessCard />. No feature logic lives here.
//
// Auth: requires either an authenticated session or the CRON_SECRET
// bearer (so background jobs can pre-warm readiness). Brand scoping is
// taken from the query param ONLY after the session is verified — we
// never let an unauthenticated caller probe an arbitrary brandId.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReadiness } from "@/lib/data-readiness";
import { isKnownModule, READINESS_CONFIG } from "@/lib/data-readiness/requirements";
import type { ReadinessModuleKey } from "@/lib/data-readiness/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const moduleParam = sp.get("module");
  if (!moduleParam || !isKnownModule(moduleParam)) {
    return NextResponse.json(
      { error: "unknown module", known: Object.keys(READINESS_CONFIG) },
      { status: 400 },
    );
  }

  // Only honor brandId for an authenticated session (cron passes none).
  const brandId = user ? sp.get("brandId") ?? undefined : undefined;

  // ── CACHING IS INTENTIONALLY DISABLED ──
  // See the "PERFORMANCE OPTIMIZATION TODO" block in
  // src/lib/data-readiness/metrics.ts. The gather is a handful of cheap
  // count/limit lookups. Do NOT add a cache here until a production trigger
  // fires (e.g. /api/readiness p95 > 300 ms, or > 100 ms TTFB regression).
  // When it does: add `Cache-Control: s-maxage=<TTL>` with TTL 5 min for
  // brand-scoped modules and 30 min for platform modules, keyed by
  // `readiness:{module}:{brandId ?? "platform"}`.
  const result = await getReadiness(moduleParam as ReadinessModuleKey, { brandId });
  return NextResponse.json(result);
}
