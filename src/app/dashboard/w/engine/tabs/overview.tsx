import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InsightCard from "@/workspace/primitives/InsightCard";
import { timeAgo, type Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Overview — "how does <engine> cover <brand>" in 15 seconds.
// Sample latest answer + best/worst prompts + citation posture.
// ============================================================

type Row = {
  id: string;
  run_at: string;
  prompt_id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  raw_response: string | null;
};

export default async function OverviewBody({ engine }: { engine: Engine }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", engine.brand.id)
    .limit(500);
  const promptList = (prompts as { id: string; text: string }[] | null) ?? [];
  const promptText = new Map(promptList.map((p) => [p.id, p.text]));
  const promptIds = promptList.map((p) => p.id);

  let latest: Row | null = null;
  const winsByPrompt = new Map<string, number>();
  const missesByPrompt = new Map<string, number>();
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id, run_at, prompt_id, brand_mentioned, brand_position, raw_response")
      .eq("engine_id", engine.id)
      .in("prompt_id", promptIds)
      .order("run_at", { ascending: false })
      .limit(500);
    const rows = (runs as Row[] | null) ?? [];
    latest = rows[0] ?? null;
    for (const r of rows) {
      if (r.brand_mentioned === null) continue;
      if (r.brand_mentioned === true) {
        winsByPrompt.set(r.prompt_id, (winsByPrompt.get(r.prompt_id) ?? 0) + 1);
      } else {
        missesByPrompt.set(r.prompt_id, (missesByPrompt.get(r.prompt_id) ?? 0) + 1);
      }
    }
  }
  const topWins = Array.from(winsByPrompt.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, n]) => ({ promptId: pid, text: promptText.get(pid) ?? "prompt", count: n }));
  const topMisses = Array.from(missesByPrompt.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, n]) => ({ promptId: pid, text: promptText.get(pid) ?? "prompt", count: n }));

  return (
    <div className="space-y-6">
      {/* Engine identity */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Engine</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{engine.displayName}</h2>
            <p className="mt-1 text-sm text-muted">{engine.meta.note}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={
                  engine.is_active
                    ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "chip border-line bg-surface text-muted"
                }
              >
                {engine.is_active ? "Active" : "Disabled"}
              </span>
              <span className="chip">{engine.meta.cites ? "Cites by default" : "Rarely cites"}</span>
              {engine.meta.requiresKey && (
                <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                  Requires {engine.meta.requiresKey}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Health cards */}
      {engine.stats.runCount === 0 && (
        <InsightCard
          variant="info"
          title="No runs yet for this engine"
          description={`Run a scan on any prompt for ${engine.brand.name} to see how ${engine.displayName} covers it.`}
        />
      )}
      {engine.stats.mentionRate7dDelta != null && engine.stats.mentionRate7dDelta <= -10 && (
        <InsightCard
          variant="warning"
          title={`Mention rate dropped ${Math.abs(engine.stats.mentionRate7dDelta)}pp on ${engine.displayName}`}
          description="Last 7d vs prior 7d. Check the Prompts tab for the specific queries you lost."
        />
      )}
      {engine.stats.mentionRate7dDelta != null && engine.stats.mentionRate7dDelta >= 10 && (
        <InsightCard
          variant="win"
          title={`Mention rate up ${engine.stats.mentionRate7dDelta}pp on ${engine.displayName}`}
          description="Last 7d vs prior 7d. Whatever you shipped is working — double down."
        />
      )}

      {/* Latest sample answer */}
      {latest && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-ink">Latest sample answer</h3>
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/dashboard/w/prompt/${latest.prompt_id}/history?run=${latest.id}`}
                  className="line-clamp-2 text-sm font-medium text-ink hover:text-accent"
                >
                  &ldquo;{promptText.get(latest.prompt_id) ?? "prompt"}&rdquo;
                </Link>
                <p className="mt-1 text-xs text-muted">{timeAgo(latest.run_at)}</p>
              </div>
              <span
                className={
                  latest.brand_mentioned === null
                    ? "chip"
                    : latest.brand_mentioned
                      ? "chip chip-accent shrink-0"
                      : "chip shrink-0 border-rose-200 bg-rose-50 text-rose-600"
                }
              >
                {latest.brand_mentioned === null
                  ? "skipped"
                  : latest.brand_mentioned
                    ? `mentioned${latest.brand_position ? ` #${latest.brand_position}` : ""}`
                    : "not mentioned"}
              </span>
            </div>
            {latest.raw_response && (
              <p className="mt-3 line-clamp-3 rounded-xl bg-surface p-3 font-mono text-xs text-muted">
                {latest.raw_response.slice(0, 300)}
                {latest.raw_response.length > 300 ? "…" : ""}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Wins + misses */}
      {(topWins.length > 0 || topMisses.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {topWins.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink">
                Best on {engine.displayName}
              </h3>
              <ul className="space-y-2">
                {topWins.map((w) => (
                  <li
                    key={w.promptId}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3"
                  >
                    <Link
                      href={`/dashboard/w/prompt/${w.promptId}/overview`}
                      className="line-clamp-1 text-sm font-medium text-ink hover:text-accent"
                    >
                      {w.text}
                    </Link>
                    <p className="mt-1 text-xs text-emerald-700">
                      {w.count} mention{w.count === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {topMisses.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink">
                Missing you on {engine.displayName}
              </h3>
              <ul className="space-y-2">
                {topMisses.map((w) => (
                  <li
                    key={w.promptId}
                    className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3"
                  >
                    <Link
                      href={`/dashboard/w/prompt/${w.promptId}/optimization`}
                      className="line-clamp-1 text-sm font-medium text-ink hover:text-accent"
                    >
                      {w.text}
                    </Link>
                    <p className="mt-1 text-xs text-rose-600">
                      {w.count} miss{w.count === 1 ? "" : "es"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
