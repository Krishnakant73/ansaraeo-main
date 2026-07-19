import { createClient } from "@/lib/supabase/server";
import type { Competitor } from "@/lib/competitor-workspace";
import PromptDominanceView from "./PromptDominanceView.client";

// ============================================================
// Competitor › Prompt Dominance — server data + client interactive
// view. The client component owns:
//   • Table + Scatter (Prompt Gap Explorer) toggle
//   • "Attack this" per-row action (POST /api/competitors/attack-prompt)
//   • Sortable columns, filter chips
//
// Server owns the aggregation — heavy join in JSON. The client is
// display + action only.
// ============================================================

type Row = {
  prompt_id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean }[] | null;
};

export default async function PromptsBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, intent")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptList = (prompts as { id: string; text: string; intent: string | null }[] | null) ?? [];
  const promptMap = new Map(promptList.map((p) => [p.id, p]));

  const promptIds = promptList.map((p) => p.id);
  let rows: Row[] = [];
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("prompt_id, brand_mentioned, competitor_mentions")
      .in("prompt_id", promptIds);
    rows = (runs as Row[] | null) ?? [];
  }

  const nameLower = competitor.name.toLowerCase();
  type Agg = {
    promptId: string;
    text: string;
    intent: string | null;
    themOnly: number;
    both: number;
    youOnly: number;
    neither: number;
    total: number;
  };
  const agg = new Map<string, Agg>();
  for (const r of rows) {
    if (r.brand_mentioned === null) continue;
    const you = r.brand_mentioned === true;
    const them = (r.competitor_mentions ?? []).some(
      (m) => m.mentioned && m.name.toLowerCase() === nameLower,
    );
    const p = promptMap.get(r.prompt_id);
    if (!p) continue;
    const cur =
      agg.get(r.prompt_id) ??
      { promptId: r.prompt_id, text: p.text, intent: p.intent, themOnly: 0, both: 0, youOnly: 0, neither: 0, total: 0 };
    cur.total += 1;
    if (you && them) cur.both += 1;
    else if (them) cur.themOnly += 1;
    else if (you) cur.youOnly += 1;
    else cur.neither += 1;
    agg.set(r.prompt_id, cur);
  }
  const sorted = Array.from(agg.values())
    .filter((a) => a.themOnly + a.both > 0)
    .sort((a, b) => b.themOnly - a.themOnly || b.both - a.both);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Prompt Dominance</h2>
        <p className="mt-1 text-sm text-muted">
          Every tracked prompt where {competitor.name} shows up. Attack the ones where they win.
        </p>
      </div>
      <PromptDominanceView
        competitorId={competitor.id}
        competitorName={competitor.name}
        rows={sorted}
      />
    </div>
  );
}
