import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/v1/competitors/[id]/timeline
//
// Union view: run events (competitor mentioned), snapshot deltas
// where |gap_pp| step > 5, and citation appearances. Ordered by
// occurred_at desc. Query params:
//   ?kind=gap|contested|position-change|snapshot
//   ?limit=100
// ============================================================

type Row = {
  id: string;
  run_at: string;
  prompt_id: string;
  engine_id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

type Kind = "gap" | "contested" | "position-change" | "snapshot";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as Kind | null;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

  const supabase = await createClient();
  const { data: comp } = await supabase
    .from("competitors")
    .select("id, brand_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", (comp as { brand_id: string }).brand_id)
    .limit(500);
  const promptList = (prompts as { id: string; text: string }[] | null) ?? [];
  const promptText = new Map(promptList.map((p) => [p.id, p.text]));
  const promptIds = promptList.map((p) => p.id);

  const events: {
    id: string;
    at: string;
    kind: Kind;
    title: string;
    detail?: string;
    href?: string;
  }[] = [];

  if (promptIds.length > 0) {
    const [runsRes, snapshotsRes] = await Promise.all([
      supabase
        .from("visibility_runs")
        .select("id, run_at, prompt_id, engine_id, brand_mentioned, competitor_mentions")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(limit),
      supabase
        .from("competitor_snapshots")
        .select("captured_on, gap_pp")
        .eq("competitor_id", id)
        .order("captured_on", { ascending: false })
        .limit(60),
    ]);

    const nameLower = (comp as { name: string }).name.toLowerCase();
    for (const r of (runsRes.data as Row[] | null) ?? []) {
      const hit = (r.competitor_mentions ?? []).find(
        (m) => m.mentioned && m.name.toLowerCase() === nameLower,
      );
      if (!hit) continue;
      const eventKind: Kind = r.brand_mentioned === true ? "contested" : "gap";
      events.push({
        id: `run-${r.id}`,
        at: r.run_at,
        kind: eventKind,
        title: (promptText.get(r.prompt_id) ?? "prompt").slice(0, 120),
        detail: hit.position ? `rank #${hit.position}` : undefined,
        href: `/dashboard/w/prompt/${r.prompt_id}/history?run=${r.id}`,
      });
    }

    const snapshots =
      ((snapshotsRes.data as { captured_on: string; gap_pp: number | null }[] | null) ?? []).filter(
        (s) => s.gap_pp != null,
      );
    for (let i = 0; i < snapshots.length - 1; i++) {
      const d = (snapshots[i].gap_pp ?? 0) - (snapshots[i + 1].gap_pp ?? 0);
      if (Math.abs(d) < 5) continue;
      events.push({
        id: `snap-${snapshots[i].captured_on}`,
        at: `${snapshots[i].captured_on}T12:00:00Z`,
        kind: "position-change",
        title: d > 0 ? `Gap widened by ${d.toFixed(1)}pp` : `Gap narrowed by ${(-d).toFixed(1)}pp`,
      });
    }
  }

  const filtered = kind ? events.filter((e) => e.kind === kind) : events;
  return NextResponse.json({
    events: filtered.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit),
  });
}
