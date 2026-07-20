import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InsightCard from "@/workspace/primitives/InsightCard";
import type { Campaign } from "@/lib/campaign-workspace";

// ============================================================
// Campaign › Overview — objective, progress, top missions, and
// a "what's next" nudge. 15-second read of where a campaign stands.
// ============================================================

type MissionRow = {
  id: string;
  title: string;
  status: string;
  priority: number;
  due_date: string | null;
};

export default async function OverviewBody({ campaign }: { campaign: Campaign }) {
  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, status, priority, due_date")
    .eq("linked_campaign_id", campaign.id)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(5);
  const topMissions = (missions as MissionRow[] | null) ?? [];

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <div className="space-y-6">
      {/* Objective + progress ring */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Objective</p>
            <p className="mt-1 text-base leading-relaxed text-ink">
              {campaign.objective ?? (
                <span className="italic text-muted">No objective set. Add one to anchor the campaign.</span>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Progress</p>
            <p className="text-2xl font-bold tracking-tight text-ink">
              {campaign.stats.progressPct == null ? "—" : `${campaign.stats.progressPct}%`}
            </p>
            <p className="text-[11px] text-muted">
              {campaign.stats.completedTasks} / {campaign.stats.taskCount} tasks done
            </p>
          </div>
        </div>
        {campaign.stats.progressPct != null && (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${campaign.stats.progressPct}%` }}
            />
          </div>
        )}
      </section>

      {/* Alert cards */}
      {campaign.stats.overdueTasks > 0 && (
        <InsightCard
          variant="warning"
          title={`${campaign.stats.overdueTasks} overdue task${campaign.stats.overdueTasks === 1 ? "" : "s"}`}
          description="These tasks passed their due date without being completed. Reassign or extend."
          href={`/dashboard/w/campaign/${campaign.id}/tasks`}
        />
      )}
      {campaign.stats.progressPct === 100 && campaign.status !== "completed" && (
        <InsightCard
          variant="win"
          title="Every task in this campaign is done"
          description="Mark the campaign complete to celebrate — or add follow-up missions to keep pushing."
        />
      )}
      {campaign.stats.missionCount === 0 && (
        <InsightCard
          variant="info"
          title="No missions yet"
          description="Accept an opportunity or create a mission and link it to this campaign to start tracking work."
          href={`/dashboard/w/brand/${campaign.brand.slug}/recommendations`}
        />
      )}

      {/* Top missions */}
      {topMissions.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Top missions</h2>
            <Link
              href={`/dashboard/w/campaign/${campaign.id}/missions`}
              className="text-xs font-medium text-accent hover:underline"
            >
              View all →
            </Link>
          </div>
          <ul className="space-y-2">
            {topMissions.map((m) => {
              const overdue =
                m.status !== "completed" && m.due_date && new Date(m.due_date).getTime() < now;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/w/mission/${m.id}/overview`}
                      className="block truncate text-sm font-medium text-ink hover:text-accent"
                    >
                      {m.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="chip">P{m.priority}</span>
                      <span
                        className={
                          m.status === "completed"
                            ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                            : m.status === "on_hold"
                              ? "chip border-amber-200 bg-amber-50 text-amber-700"
                              : "chip"
                        }
                      >
                        {m.status.replace(/_/g, " ")}
                      </span>
                      {overdue && (
                        <span className="chip border-rose-200 bg-rose-50 text-rose-600">
                          overdue
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title="Full Mission Control"
          description="Task queue, radar, weekly progress — the brand's operational cockpit."
          href={`/dashboard/b/${campaign.brand.slug}`}
          meta="Mission Control"
        />
        <InsightCard
          variant="opportunity"
          title="Brand workspace"
          description={`Every tab for ${campaign.brand.name}: visibility, competitors, insights.`}
          href={`/dashboard/w/brand/${campaign.brand.slug}/overview`}
          meta="Brand"
        />
      </div>
    </div>
  );
}
