import { createClient } from "@/lib/supabase/server";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Insights — trend + intent breakdown + position mix.
// Pure aggregation over visibility_runs. No LLM synthesis — the
// deterministic story is the story.
// ============================================================

type Row = {
  run_at: string;
  prompt_id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

export default async function InsightsBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, intent")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptList = (prompts as { id: string; intent: string | null }[] | null) ?? [];
  const intentByPrompt = new Map(promptList.map((p) => [p.id, p.intent]));
  const promptIds = promptList.map((p) => p.id);

  let rows: Row[] = [];
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("run_at, prompt_id, brand_mentioned, competitor_mentions")
      .in("prompt_id", promptIds)
      .order("run_at", { ascending: false })
      .limit(1000);
    rows = (runs as Row[] | null) ?? [];
  }

  const nameLower = competitor.name.toLowerCase();
  const isMention = (r: Row) =>
    (r.competitor_mentions ?? []).find((m) => m.mentioned && m.name.toLowerCase() === nameLower);

  // Trend: weekly buckets over the last 8 weeks.
  const weekBuckets: { label: string; total: number; them: number }[] = [];
  const now = Date.now();
  const week = 7 * 86_400_000;
  for (let i = 7; i >= 0; i--) {
    const to = now - i * week;
    const from = to - week;
    const label =
      i === 0
        ? "this wk"
        : i === 1
          ? "last wk"
          : `${i}w ago`;
    const inBucket = rows.filter((r) => {
      const t = new Date(r.run_at).getTime();
      return t >= from && t < to && r.brand_mentioned !== null;
    });
    const themInBucket = inBucket.filter(isMention).length;
    weekBuckets.push({ label, total: inBucket.length, them: themInBucket });
  }
  const maxRate = Math.max(
    1,
    ...weekBuckets.map((b) => (b.total > 0 ? Math.round((b.them / b.total) * 100) : 0)),
  );

  // Intent breakdown.
  const intentMap = new Map<string, { total: number; them: number }>();
  for (const r of rows) {
    if (r.brand_mentioned === null) continue;
    const intent = intentByPrompt.get(r.prompt_id) ?? "unknown";
    const cur = intentMap.get(intent) ?? { total: 0, them: 0 };
    cur.total += 1;
    if (isMention(r)) cur.them += 1;
    intentMap.set(intent, cur);
  }
  const intentRows = Array.from(intentMap.entries())
    .map(([k, v]) => ({
      intent: k,
      rate: v.total > 0 ? Math.round((v.them / v.total) * 100) : 0,
      total: v.total,
    }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.rate - a.rate);

  // Position distribution (top 5 buckets).
  const positions: number[] = [];
  for (const r of rows) {
    const hit = isMention(r);
    if (hit?.position != null && hit.position > 0) positions.push(hit.position);
  }
  const posDist = [1, 2, 3, 4, 5].map((p) => ({
    pos: p,
    count: positions.filter((x) => x === p).length,
  }));
  const posMax = Math.max(1, ...posDist.map((p) => p.count));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Insights</h2>
        <p className="mt-1 text-sm text-muted">
          Trend, intent breakdown, and position distribution for {competitor.name} vs{" "}
          {competitor.brand.name}.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">8-week mention trend</p>
        <div className="mt-4 grid grid-cols-8 items-end gap-1.5">
          {weekBuckets.map((b, i) => {
            const rate = b.total > 0 ? Math.round((b.them / b.total) * 100) : 0;
            const h = Math.max(4, Math.round((rate / maxRate) * 120));
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-md bg-rose-500/70"
                  style={{ height: `${h}px` }}
                  title={`${rate}% · ${b.them}/${b.total}`}
                />
                <span className="text-[10px] text-muted">{b.label}</span>
                <span className="text-[10px] font-mono text-ink">{rate}%</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Mention rate by intent</p>
          {intentRows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No mentioned runs yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {intentRows.map((r) => (
                <li key={r.intent}>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="capitalize text-ink">
                      {r.intent === "unknown" ? "uncategorized" : r.intent.replace(/_/g, " ")}
                    </span>
                    <span>
                      {r.rate}% · {r.total} run{r.total === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-rose-500/70" style={{ width: `${r.rate}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Position distribution</p>
          {positions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No positions recorded.</p>
          ) : (
            <div className="mt-3 flex items-end gap-2">
              {posDist.map((p) => {
                const h = Math.max(4, Math.round((p.count / posMax) * 120));
                return (
                  <div key={p.pos} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-md bg-accent/70"
                      style={{ height: `${h}px` }}
                      title={`Position #${p.pos}: ${p.count}`}
                    />
                    <span className="text-[10px] text-muted">#{p.pos}</span>
                    <span className="text-[10px] font-mono text-ink">{p.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
