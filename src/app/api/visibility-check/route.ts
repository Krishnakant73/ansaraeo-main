import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { parseJsonBody, visibilityCheckSchema } from "@/lib/validate";
import { runVisibilityCheck, type EngineOutcome } from "@/lib/visibility-engine";

// ============================================================
// POST /api/visibility-check
// Body: { promptId: string }
//
// Delegates to the canonical runVisibilityCheck() pipeline in
// src/lib/visibility-engine.ts — the SAME function the nightly cron and
// content generation use. This keeps a manual "Run check" click identical in
// engine coverage and data quality to scheduled runs (every active engine,
// deterministic mention reconciliation, perception capture). There is no
// duplicated engine registry or classification here — that logic lives in the
// lib as the single source of truth, so the two paths can never drift apart.
//
// Per-engine failure isolation and graceful skips (missing API keys, no AI
// Overview for a query) are handled inside runVisibilityCheck via
// Promise.allSettled.
// ============================================================

const visibilityLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anon";
    const rl = visibilityLimiter(ip);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests — please slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const parsed = await parseJsonBody(request, visibilityCheckSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { promptId } = parsed.data;

    let outcomes: EngineOutcome[];
    try {
      outcomes = await runVisibilityCheck(promptId);
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("Prompt not found")) {
        return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
      }
      throw err;
    }

    // Map the canonical EngineOutcome[] to the response shape the Prompts
    // manager and FirstRunCTA already render (engine / success / brand_mentioned / error).
    const results = outcomes.map((o: EngineOutcome) => {
      if (!o.success) return { engine: o.engine, success: false, error: o.error };
      if ("skipped" in o) return { engine: o.engine, success: true };
      return { engine: o.engine, success: true, brand_mentioned: o.brand_mentioned };
    });

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("visibility-check error:", err);
    return NextResponse.json({ error: "Internal error running visibility check" }, { status: 500 });
  }
}
