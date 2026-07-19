import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

// ============================================================
// GET /api/share/report/[token] — returns a minimal read-only report
// payload for a valid, unexpired share_view_tokens row. No auth
// required. Rate limited per IP.
//
// This is intentionally a JSON API, not a page render — the client is
// a static /share/report/[token] page that consumes this data and
// renders view-only markup. Keeps auth surface narrow.
// ============================================================

const shareLimit = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const check = shareLimit(`share-report:${ip}`);
  if (!check.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: row } = await sb
    .from("share_view_tokens")
    .select("token, brand_id, expires_at, revoked")
    .eq("token", token)
    .single();

  if (!row || row.revoked || new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "token expired or invalid" }, { status: 404 });
  }

  const [{ data: brand }, { data: prompts }] = await Promise.all([
    sb.from("brands").select("id, name, domain, industry").eq("id", row.brand_id).single(),
    sb.from("prompts").select("id, text").eq("brand_id", row.brand_id).limit(50),
  ]);

  const promptIds = (prompts ?? []).map((p) => p.id);
  const { data: runs } = promptIds.length
    ? await sb
        .from("visibility_runs")
        .select("prompt_id, brand_mentioned, engine_id, engines!inner(name)")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(500)
    : { data: [] };

  const total = runs?.length ?? 0;
  const mentioned = runs?.filter((r) => r.brand_mentioned).length ?? 0;
  const score = total ? Math.round((mentioned / total) * 100) : 0;

  return NextResponse.json({
    brand: brand ?? null,
    score,
    total,
    mentioned,
    runs: runs ?? [],
  });
}
