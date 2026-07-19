import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo, type Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › History — every run this engine performed for the brand,
// newest first. Rows deep-link to the shared RunReplayDrawer.
// ============================================================

type Row = {
  id: string;
  run_at: string;
  prompt_id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null;
};

export default async function HistoryBody({ engine }: { engine: Engine }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", engine.brand.id)
    .limit(500);
  const promptText = new Map(
    ((prompts as { id: string; text: string }[] | null) ?? []).map((p) => [p.id, p.text]),
  );
  const promptIds = Array.from(promptText.keys());

  let rows: Row[] = [];
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select(
        "id, run_at, prompt_id, brand_mentioned, brand_position, sentiment, recommendation_alignment",
      )
      .eq("engine_id", engine.id)
      .in("prompt_id", promptIds)
      .order("run_at", { ascending: false })
      .limit(200);
    rows = (runs as Row[] | null) ?? [];
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">History on {engine.displayName}</h2>
        <p className="mt-1 text-sm text-muted">
          Every run this engine performed for {engine.brand.name}, newest first.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No runs yet on {engine.displayName}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Prompt</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Position</th>
                <th className="px-4 py-3 font-semibold">Sentiment</th>
                <th className="px-4 py-3 font-semibold">Alignment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const skipped = r.brand_mentioned === null;
                const mentioned = r.brand_mentioned === true;
                return (
                  <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-surface">
                    <td className="px-4 py-3 text-xs text-muted">
                      <Link
                        href={`/dashboard/w/prompt/${r.prompt_id}/history?run=${r.id}`}
                        className="block"
                      >
                        {timeAgo(r.run_at)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/w/prompt/${r.prompt_id}/history?run=${r.id}`}
                        className="line-clamp-1 text-sm text-ink hover:text-accent"
                      >
                        {promptText.get(r.prompt_id) ?? "prompt"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          skipped
                            ? "chip"
                            : mentioned
                              ? "chip chip-accent"
                              : "chip border-rose-200 bg-rose-50 text-rose-600"
                        }
                      >
                        {skipped ? "skipped" : mentioned ? "mentioned" : "not mentioned"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {r.brand_position != null ? `#${r.brand_position}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{r.sentiment ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.recommendation_alignment && r.recommendation_alignment !== "neutral" ? (
                        <span
                          className={
                            r.recommendation_alignment === "aligned"
                              ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "chip border-amber-200 bg-amber-50 text-amber-700"
                          }
                        >
                          {r.recommendation_alignment}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
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
