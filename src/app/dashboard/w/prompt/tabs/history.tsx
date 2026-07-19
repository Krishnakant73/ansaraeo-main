import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Prompt } from "@/lib/prompt-workspace";
import { timeAgo } from "@/lib/prompt-workspace";
import RunReplayDrawer from "./RunReplayDrawer.client";

// ============================================================
// Prompt › History — every visibility_run for this prompt, most
// recent first. Row click deep-links to ?run=<id> which opens the
// RunReplayDrawer. Also surfaces recent history_events as "Notable
// moments" above the table.
// ============================================================

type Row = {
  id: string;
  run_at: string;
  engine_id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null;
};

type EventRow = {
  id: string;
  occurred_at: string;
  event_type: string;
  engine_name: string | null;
};

const EVENT_LABEL: Record<string, string> = {
  FIRST_MENTION: "First mention",
  MENTION_GAINED: "Mention gained",
  MENTION_LOST: "Mention lost",
  POSITION_IMPROVED: "Position improved",
  POSITION_DROPPED: "Position dropped",
  CITATION_GAINED: "Citation gained",
  CITATION_LOST: "Citation lost",
  COMPETITOR_GAINED: "Competitor gained",
  COMPETITOR_LOST: "Competitor lost",
  SENTIMENT_SHIFTED: "Sentiment shifted",
  FIRST_RECOMMENDATION: "First recommendation",
  RECOMMENDATION_GAINED: "Recommendation gained",
  RECOMMENDATION_LOST: "Recommendation lost",
};

export default async function HistoryBody({ prompt }: { prompt: Prompt }) {
  const supabase = await createClient();
  const [runsRes, enginesRes, eventsRes] = await Promise.all([
    supabase
      .from("visibility_runs")
      .select("id, run_at, engine_id, brand_mentioned, brand_position, sentiment, recommendation_alignment")
      .eq("prompt_id", prompt.id)
      .order("run_at", { ascending: false })
      .limit(200),
    supabase.from("engines").select("id, name"),
    // history_events table may be absent pre-migration_016 — degrade quietly.
    supabase
      .from("history_events")
      .select("id, occurred_at, event_type, engine_name")
      .eq("prompt_id", prompt.id)
      .order("occurred_at", { ascending: false })
      .limit(8),
  ]);

  const engines = new Map<string, string>();
  for (const e of (enginesRes.data as { id: string; name: string }[] | null) ?? []) {
    engines.set(e.id, e.name);
  }
  const rows = (runsRes.data as Row[] | null) ?? [];
  const events = (eventsRes.data as EventRow[] | null) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">History</h2>
        <p className="mt-1 text-sm text-muted">
          Every AI-engine run against this prompt, stored as immutable historical knowledge.
        </p>
      </div>

      {events.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Notable moments</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <span className="text-ink">
                  {EVENT_LABEL[e.event_type] ?? e.event_type}
                  {e.engine_name && (
                    <span className="ml-1 text-muted">
                      · {e.engine_name.replace(/_/g, " ")}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted">{timeAgo(e.occurred_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No runs yet.</p>
          <p className="mt-1 text-xs text-muted">
            Press <kbd className="rounded border border-line bg-surface px-1">E</kbd> to run a scan.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Engine</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Position</th>
                <th className="px-4 py-3 font-semibold">Sentiment</th>
                <th className="px-4 py-3 font-semibold">Alignment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const engineName = engines.get(r.engine_id) ?? "unknown";
                const mentioned = r.brand_mentioned === true;
                const skipped = r.brand_mentioned === null;
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-line/60 last:border-0 transition-colors hover:bg-surface"
                  >
                    <td className="px-4 py-3 text-xs text-muted">
                      <Link
                        href={`/dashboard/w/prompt/${prompt.id}/history?run=${r.id}`}
                        className="block"
                      >
                        {timeAgo(r.run_at)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-ink">
                      {engineName.replace(/_/g, " ")}
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

      <RunReplayDrawer brandName={prompt.brand.name} promptId={prompt.id} />
    </div>
  );
}
