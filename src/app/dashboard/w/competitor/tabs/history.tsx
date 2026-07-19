import { createClient } from "@/lib/supabase/server";
import { timeAgo, type Competitor } from "@/lib/competitor-workspace";
import Link from "next/link";

// ============================================================
// Competitor › History — a chronological log of every run where
// this competitor appeared. Rows deep-link to the prompt workspace
// with ?run=<id> so the RunReplayDrawer opens on the exact answer.
// ============================================================

type Row = {
  id: string;
  run_at: string;
  prompt_id: string;
  engine_id: string;
  brand_mentioned: boolean | null;
  competitor_mentions:
    | { name: string; mentioned: boolean; position: number | null }[]
    | null;
};

export default async function HistoryBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptText = new Map(
    ((prompts as { id: string; text: string }[] | null) ?? []).map((p) => [p.id, p.text]),
  );
  const promptIds = Array.from(promptText.keys());

  let hits: (Row & { position: number | null })[] = [];
  const engineMap = new Map<string, string>();
  if (promptIds.length > 0) {
    const [runsRes, enginesRes] = await Promise.all([
      supabase
        .from("visibility_runs")
        .select("id, run_at, prompt_id, engine_id, brand_mentioned, competitor_mentions")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(400),
      supabase.from("engines").select("id, name"),
    ]);
    for (const e of (enginesRes.data as { id: string; name: string }[] | null) ?? []) {
      engineMap.set(e.id, e.name);
    }
    const nameLower = competitor.name.toLowerCase();
    for (const r of (runsRes.data as Row[] | null) ?? []) {
      const hit = (r.competitor_mentions ?? []).find(
        (m) => m.mentioned && m.name.toLowerCase() === nameLower,
      );
      if (!hit) continue;
      hits.push({ ...r, position: hit.position ?? null });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">History</h2>
        <p className="mt-1 text-sm text-muted">
          Every AI-engine run where {competitor.name} was mentioned. Click a row to see the raw
          answer.
        </p>
      </div>

      {hits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No mentions of {competitor.name} yet.</p>
          <p className="mt-1 text-xs text-muted">
            Run scans on the prompts above to build competitive history.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Engine</th>
                <th className="px-4 py-3 font-semibold">Prompt</th>
                <th className="px-4 py-3 font-semibold">Position</th>
                <th className="px-4 py-3 font-semibold">You?</th>
              </tr>
            </thead>
            <tbody>
              {hits.slice(0, 100).map((h) => {
                const engineName = engineMap.get(h.engine_id) ?? "unknown";
                const you = h.brand_mentioned === true;
                return (
                  <tr key={h.id} className="border-b border-line/60 last:border-0 hover:bg-surface">
                    <td className="px-4 py-3 text-xs text-muted">{timeAgo(h.run_at)}</td>
                    <td className="px-4 py-3 text-sm capitalize text-ink">
                      {engineName.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/w/prompt/${h.prompt_id}/history?run=${h.id}`}
                        className="line-clamp-1 text-sm text-ink hover:text-accent"
                      >
                        {promptText.get(h.prompt_id) ?? "prompt"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {h.position != null ? `#${h.position}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {you ? (
                        <span className="chip chip-accent">also mentioned</span>
                      ) : h.brand_mentioned === false ? (
                        <span className="chip border-rose-200 bg-rose-50 text-rose-600">you missed</span>
                      ) : (
                        <span className="chip">skipped</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
