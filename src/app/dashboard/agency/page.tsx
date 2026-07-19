import Link from "next/link";
import { Building2, ListTodo, Flag, Inbox, Eye, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import SwitchBrandButton from "@/components/dashboard/SwitchBrandButton";

export const dynamic = "force-dynamic";

export default async function AgencyPage() {
  const supabase = await createClient();
  const { allBrands, brand: selected } = await getSelectedBrand();

  if (allBrands.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="No client brands yet"
        description="Add a brand to your org to manage it from the Agency Workspace."
        action={
          <Link href="/dashboard/onboarding" className="btn-primary">
            Add a brand
          </Link>
        }
      />
    );
  }

  const brandIds = allBrands.map((b) => b.id);

  const { data: missions } = await supabase
    .from("missions")
    .select("id, brand_id, status")
    .in("brand_id", brandIds);
  const missionIds = (missions ?? []).map((m: { id: string }) => m.id);

  const [tasksRes, oppsRes, snapsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("mission_id, status")
      .in("mission_id", missionIds.length ? missionIds : ["__none__"]),
    supabase
      .from("opportunity_recommendations")
      .select("brand_id, status")
      .in("brand_id", brandIds),
    supabase
      .from("benchmark_brand_snapshots")
      .select("brand_id, avg_visibility, period_start")
      .in("brand_id", brandIds)
      .eq("engine", "*"),
  ]);

  const tasks = (tasksRes.data ?? []) as { mission_id: string; status: string }[];
  const opps = (oppsRes.data ?? []) as { brand_id: string; status: string }[];
  const snaps = (snapsRes.data ?? []) as {
    brand_id: string;
    avg_visibility: number | null;
    period_start: string;
  }[];

  const missionBrand = new Map<string, number>();
  for (const m of missions ?? []) {
    missionBrand.set(m.brand_id, (missionBrand.get(m.brand_id) ?? 0) + 1);
  }

  const taskByMission = new Map<string, { status: string }[]>();
  for (const t of tasks) {
    const mb = (missions ?? []).find((m: { id: string }) => m.id === t.mission_id);
    if (!mb) continue;
    const arr = taskByMission.get(mb.brand_id) ?? [];
    arr.push({ status: t.status });
    taskByMission.set(mb.brand_id, arr);
  }

  const oppBrand = new Map<string, number>();
  for (const o of opps) oppBrand.set(o.brand_id, (oppBrand.get(o.brand_id) ?? 0) + 1);

  const visByBrand = new Map<string, number | null>();
  const periodByBrand = new Map<string, string>();
  for (const s of snaps) {
    const prev = periodByBrand.get(s.brand_id);
    if (prev === undefined || s.period_start > prev) {
      visByBrand.set(s.brand_id, s.avg_visibility);
      periodByBrand.set(s.brand_id, s.period_start);
    }
  }

  const rows = allBrands.map((b) => {
    const bt = taskByMission.get(b.id) ?? [];
    return {
      id: b.id,
      name: b.name,
      industry: b.industry,
      activeMissions: (missions ?? []).filter(
        (m: { brand_id: string; status: string }) => m.brand_id === b.id && m.status === "active",
      ).length,
      openTasks: bt.filter((t) => t.status !== "done" && t.status !== "cancelled").length,
      openOpps: oppBrand.get(b.id) ?? 0,
      visibility: visByBrand.get(b.id) ?? null,
    };
  });

  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

  return (
    <div>
      <PageHeader
        title="Agency Workspace"
        subtitle="Manage every client brand from one portfolio view. Switch brands without leaving the dashboard."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{r.name}</p>
                <p className="text-xs text-muted">{r.industry ?? "—"}</p>
              </div>
              {selected?.id === r.id ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Active
                </span>
              ) : (
                <SwitchBrandButton brandId={r.id} name={r.name} />
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Mini label="Active missions" value={r.activeMissions} icon={<Flag className="h-3.5 w-3.5" />} />
              <Mini label="Open tasks" value={r.openTasks} icon={<ListTodo className="h-3.5 w-3.5" />} />
              <Mini label="Open opps" value={r.openOpps} icon={<Inbox className="h-3.5 w-3.5" />} />
              <Mini label="Visibility" value={pct(r.visibility)} icon={<Eye className="h-3.5 w-3.5" />} />
            </div>
          </div>
        ))}
      </div>

      {allBrands.length === 1 && (
        <p className="mt-6 text-center text-sm text-muted">
          <Building2 className="mr-1 inline h-4 w-4" />
          This org has a single brand. Invite a teammate or add another brand to use the Agency
          Workspace as a multi-client portfolio.
        </p>
      )}
    </div>
  );
}

function Mini({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface/60 px-3 py-2">
      <div className="flex items-center gap-1 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
