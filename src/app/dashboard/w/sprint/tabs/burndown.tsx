import { createClient } from "@/lib/supabase/server";
import type { Sprint } from "@/lib/sprint-workspace";

// ============================================================
// Sprint › Burndown — a lightweight burndown chart. For each day in
// the sprint window, count tasks NOT yet complete at end-of-day.
// Compared against an ideal-linear line from taskCount → 0. Pure SVG,
// no chart library. Handles open-ended sprints (no end_date) by
// falling back to a rolling 14-day window.
// ============================================================

type Row = { completed_at: string | null };

export default async function BurndownBody({ sprint }: { sprint: Sprint }) {
  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("missions")
    .select("id")
    .eq("linked_sprint_id", sprint.id);
  const missionIds = ((missions as { id: string }[] | null) ?? []).map((m) => m.id);

  let rows: Row[] = [];
  if (missionIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("completed_at")
      .in("mission_id", missionIds);
    rows = (tasks as Row[] | null) ?? [];
  }

  // Fix the window: prefer sprint start/end; otherwise last 14 days ending now.
  const day = 86_400_000;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const end = sprint.end_date ? new Date(sprint.end_date).getTime() : now;
  const start = sprint.start_date
    ? new Date(sprint.start_date).getTime()
    : end - 14 * day;
  const totalDays = Math.max(1, Math.round((end - start) / day));
  const totalTasks = rows.length;

  // Series: for each day 0..totalDays, count tasks whose completed_at > start+iDay.
  // Equivalent: tasks still incomplete at end of that day.
  const remaining: number[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const cutoff = start + i * day;
    const done = rows.filter(
      (t) => t.completed_at && new Date(t.completed_at).getTime() <= cutoff,
    ).length;
    remaining.push(Math.max(0, totalTasks - done));
  }
  const ideal = Array.from({ length: totalDays + 1 }, (_, i) =>
    Math.round(totalTasks * (1 - i / totalDays)),
  );

  // Where are we today on the timeline (as a 0..totalDays index)?
  const todayIndex = Math.min(totalDays, Math.max(0, Math.round((now - start) / day)));

  const W = 640;
  const H = 240;
  const pad = { l: 40, r: 16, t: 20, b: 30 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxY = Math.max(1, totalTasks);
  const xFor = (i: number) => pad.l + (innerW * i) / totalDays;
  const yFor = (v: number) => pad.t + innerH * (1 - v / maxY);
  const actualPath = remaining
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`)
    .join(" ");
  const idealPath = ideal
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`)
    .join(" ");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Burndown</h2>
        <p className="mt-1 text-sm text-muted">
          Remaining tasks per day vs the linear ideal.{" "}
          {sprint.start_date && sprint.end_date ? (
            <>
              Window {new Date(sprint.start_date).toLocaleDateString()} →{" "}
              {new Date(sprint.end_date).toLocaleDateString()}.
            </>
          ) : (
            <>No end date set — showing the last 14 days.</>
          )}
        </p>
      </div>

      {totalTasks === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No tasks to burn down yet.</p>
          <p className="mt-1 text-xs text-muted">Assign missions to this sprint to fill the chart.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Burndown chart">
            {/* Axes */}
            <line
              x1={pad.l}
              y1={pad.t}
              x2={pad.l}
              y2={H - pad.b}
              stroke="currentColor"
              className="text-line"
            />
            <line
              x1={pad.l}
              y1={H - pad.b}
              x2={W - pad.r}
              y2={H - pad.b}
              stroke="currentColor"
              className="text-line"
            />
            {/* Y-axis labels */}
            {[0, 0.5, 1].map((r) => (
              <text
                key={r}
                x={pad.l - 6}
                y={pad.t + innerH * (1 - r) + 3}
                textAnchor="end"
                fontSize={10}
                className="fill-muted"
              >
                {Math.round(maxY * r)}
              </text>
            ))}
            {/* Today marker */}
            {todayIndex >= 0 && todayIndex <= totalDays && (
              <line
                x1={xFor(todayIndex)}
                y1={pad.t}
                x2={xFor(todayIndex)}
                y2={H - pad.b}
                stroke="currentColor"
                className="text-accent/40"
                strokeDasharray="3 3"
              />
            )}
            {/* Ideal line */}
            <path d={idealPath} fill="none" strokeWidth={1.5} stroke="currentColor" className="text-muted/50" strokeDasharray="4 3" />
            {/* Actual line */}
            <path d={actualPath} fill="none" strokeWidth={2} stroke="currentColor" className="text-accent" />
            {/* Actual points */}
            {remaining.map((v, i) => (
              <circle key={i} cx={xFor(i)} cy={yFor(v)} r={2.5} className="fill-accent" />
            ))}
            {/* X-axis labels: start, middle, end */}
            <text x={xFor(0)} y={H - 8} textAnchor="start" fontSize={10} className="fill-muted">
              start
            </text>
            <text
              x={xFor(Math.floor(totalDays / 2))}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              className="fill-muted"
            >
              day {Math.floor(totalDays / 2)}
            </text>
            <text x={xFor(totalDays)} y={H - 8} textAnchor="end" fontSize={10} className="fill-muted">
              end
            </text>
          </svg>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-accent" aria-hidden /> Actual
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-muted/60" style={{ borderTop: "1px dashed" }} aria-hidden />{" "}
              Ideal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-accent/40" style={{ borderTop: "1px dashed" }} aria-hidden />{" "}
              Today
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
