import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/v1/competitors/[id]/simulate
//
// Deterministic battle simulator. Given a proposed move + the
// competitor's current gap, returns an outcome record. Numbers
// are directional — the UI copy makes that explicit ("Modeled —
// not a guarantee"). No LLM call; everything is a function of the
// stored stats + a small effect-size table per move type.
//
// Auth: cookie client + RLS handles access. Reading via the same
// getCompetitorById() would work but is one extra query; we
// re-derive the small stats we need here inline for speed.
// ============================================================

type Move = "comparison-page" | "citation-earn" | "review-cluster" | "faq-page";

// Effect sizes calibrated conservatively — the goal is direction, not
// promised deltas. Real forecasts should replace these when the
// forecast_runs model is trained on longitudinal data.
const EFFECTS: Record<
  Move,
  {
    label: string;
    mentionRateDelta: number;      // pp
    citationShareDelta: number;    // pp
    timingDays: number;
    counterMove: string;
    counterRecovery: number;       // 0..1, share of gain that reverts if they respond
  }
> = {
  "comparison-page": {
    label: "Comparison page",
    mentionRateDelta: 6,
    citationShareDelta: 4,
    timingDays: 21,
    counterMove: `They ship a matching comparison page — their content velocity outpaces you and the gain reverts.`,
    counterRecovery: 0.5,
  },
  "citation-earn": {
    label: "Earned citation",
    mentionRateDelta: 10,
    citationShareDelta: 12,
    timingDays: 45,
    counterMove: `They earn a competing citation on the same host — parity restored on that anchor.`,
    counterRecovery: 0.4,
  },
  "review-cluster": {
    label: "Review cluster",
    mentionRateDelta: 5,
    citationShareDelta: 3,
    timingDays: 30,
    counterMove: `They seed a symmetric review push — engines average the two footprints.`,
    counterRecovery: 0.6,
  },
  "faq-page": {
    label: "FAQ page",
    mentionRateDelta: 4,
    citationShareDelta: 2,
    timingDays: 14,
    counterMove: `They publish an FAQ page covering the same intents — the ranking parity returns.`,
    counterRecovery: 0.65,
  },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { move?: Move };
  const move = body.move;
  if (!move || !(move in EFFECTS)) {
    return NextResponse.json({ error: "Invalid or missing move" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: competitor } = await supabase
    .from("competitors")
    .select("id, brand_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!competitor) {
    return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
  }

  // The stored stats don't need re-derivation for the deterministic
  // model — we just apply the effect table. Real forecast would inject
  // recent snapshot volatility here.
  const eff = EFFECTS[move];
  const postCounterDelta =
    eff.mentionRateDelta - eff.mentionRateDelta * eff.counterRecovery;

  return NextResponse.json({
    headline: `${eff.label} · projected +${eff.mentionRateDelta}pp mention rate over ~${eff.timingDays}d`,
    mentionRateDelta: eff.mentionRateDelta,
    citationShareDelta: eff.citationShareDelta,
    timingDays: eff.timingDays,
    counterMove: eff.counterMove,
    postCounterDelta: round1(postCounterDelta),
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
