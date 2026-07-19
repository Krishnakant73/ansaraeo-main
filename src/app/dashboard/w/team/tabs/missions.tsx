import { createClient } from "@/lib/supabase/server";
import { timeAgo, type Team } from "@/lib/team-workspace";

// ============================================================
// Team › Missions — active + on-hold missions across every brand
// under the team's org. Approximation: migration_021 doesn't wire
// missions to teams (mission.team_id doesn't exist), so we scope to
// the org's brand list. Documented in-UI so users know why.
// ============================================================

type Row = {
  id: string;
  title: string;
  status: string;
  priority: number;
  updated_at: string;
  brand_id: string;
};

export default async function MissionsBody({ team }: { team: Team }) {
  const supabase = await createClient();
  const brandIds = team.brands.map((b) => b.id);
  let rows: Row[] = [];
  if (brandIds.length > 0) {
    const { data } = await supabase
      .from("missions")
      .select("id, title, status, priority, updated_at, brand_id")
      .in("brand_id", brandIds)
      .in("status", ["active", "on_hold"])
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(50);
    rows = (data as Row[] | null) ?? [];
  }
  const brandLookup = new Map(team.brands.map((b) => [b.id, b]));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Active missions</h2>
        <p className="mt-1 text-sm text-muted">
          Missions in-flight across brands under {team.org.name ?? "this org"}. Missions aren&rsquo;t
          attributed to teams directly — this is the org&rsquo;s working set.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No active missions.</p>
          <p className="mt-1 text-xs text-muted">
            Missions get created when opportunities are accepted or automations fire.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => {
            const brand = brandLookup.get(m.brand_id);
            return (
              <li key={m.id}>
                <a
                  href={`/dashboard/w/mission/${m.id}/overview`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 transition-colors hover:border-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink group-hover:text-accent">
                      {m.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <span className="chip text-[10px]">P{m.priority}</span>
                      <span className="chip text-[10px]">{m.status.replace(/_/g, " ")}</span>
                      {brand && <span className="chip text-[10px]">{brand.name}</span>}
                      <span>· {timeAgo(m.updated_at)}</span>
                    </div>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
