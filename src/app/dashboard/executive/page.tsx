import Link from "next/link";
import {
  BarChart3,
  Building2,
  ListTodo,
  Flag,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Eye,
  IndianRupee,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";

export const dynamic = "force-dynamic";

export default async function ExecutivePage() {
  const supabase = await createClient();
  const { allBrands } = await getSelectedBrand();

  if (allBrands.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-6 w-6" />}
        title="No brands yet"
        description="Add a brand to your org to start tracking AI-search performance across the portfolio."
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
      .select("mission_id, status, type, verification_result")
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

  const tasks = (tasksRes.data ?? []) as {
    mission_id: string;
    status: string;
    type: string;
    verification_result: { passed?: boolean } | null;
  }[];
  const opps = (oppsRes.data ?? []) as { brand_id: string; status: string }[];
  const snaps = (snapsRes.data ?? []) as {
    brand_id: string;
    avg_visibility: number | null;
    period_start: string;
  }[];

  // ---- org-wide rollups ----
  const activeMissions = (missions ?? []).filter((m: { status: string }) => m.status === "active").length;
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const openOpps = opps.filter((o) => o.status === "open").length;

  const verifyDone = tasks.filter((t) => t.type === "verify" && t.status === "done");
  const verifyPassed = verifyDone.filter((t) => t.verification_result?.passed);
  const verifyPassRate = verifyDone.length
    ? Math.round((verifyPassed.length / verifyDone.length) * 100)
    : null;

  // latest visibility per brand
  const visByBrand = new Map<string, number | null>();
  const periodByBrand = new Map<string, string>();
  for (const s of snaps) {
    const prev = periodByBrand.get(s.brand_id);
    if (prev === undefined || s.period_start > prev) {
      visByBrand.set(s.brand_id, s.avg_visibility);
      periodByBrand.set(s.brand_id, s.period_start);
    }
  }
  const visValues = allBrands
    .map((b) => visByBrand.get(b.id))
    .filter((v): v is number => typeof v === "number");
  const avgVisibility = visValues.length
    ? Math.round((visValues.reduce((a, b) => a + b, 0) / visValues.length) * 1000) / 10
    : null;

  // ---- per-brand rows ----
  const missionBrand = new Map<string, number>();
  for (const m of missions ?? []) missionBrand.set(m.brand_id, (missionBrand.get(m.brand_id) ?? 0) + 1);

  const taskMissionBrand = new Map<string, string>();
  const brandTasks = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const mid = t.mission_id;
    // map mission -> brand
    const mb = (missions ?? []).find((m: { id: string }) => m.id === mid);
    if (!mb) continue;
    const arr = brandTasks.get(mb.brand_id) ?? [];
    arr.push(t);
    brandTasks.set(mb.brand_id, arr);
  }
  const oppBrand = new Map<string, number>();
  for (const o of opps) oppBrand.set(o.brand_id, (oppBrand.get(o.brand_id) ?? 0) + 1);

  const rows = allBrands.map((b) => {
    const bt = brandTasks.get(b.id) ?? [];
    return {
      id: b.id,
      name: b.name,
      industry: b.industry,
      activeMissions: missionBrand.get(b.id) ?? 0,
      openTasks: bt.filter((t) => t.status !== "done" && t.status !== "cancelled").length,
      openOpps: oppBrand.get(b.id) ?? 0,
      visibility: visByBrand.get(b.id) ?? null,
    };
  });

  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Portfolio-wide AI-search performance across every brand in your org."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Brands" value={allBrands.length} icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Active missions" value={activeMissions} icon={<Flag className="h-4 w-4" />} />
        <StatCard label="Open tasks" value={openTasks} icon={<ListTodo className="h-4 w-4" />} />
        <StatCard
          label="Blocked"
          value={blocked}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={blocked > 0}
        />
        <StatCard label="Open opportunities" value={openOpps} icon={<Inbox className="h-4 w-4" />} />
        <StatCard
          label="Verify pass rate"
          value={verifyPassRate == null ? "—" : `${verifyPassRate}%`}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Avg visibility"
          value={pct(avgVisibility != null ? avgVisibility / 100 : null)}
          icon={<Eye className="h-4 w-4" />}
        />
      </div>

      <Panel className="mt-6" title="Brand portfolio" description="Per-brand health at a glance.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4">Brand</th>
                <th className="py-2 pr-4">Industry</th>
                <th className="py-2 pr-4">Active missions</th>
                <th className="py-2 pr-4">Open tasks</th>
                <th className="py-2 pr-4">Open opps</th>
                <th className="py-2 pr-4">Visibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4 font-medium text-ink">{r.name}</td>
                  <td className="py-2 pr-4 text-muted">{r.industry ?? "—"}</td>
                  <td className="py-2 pr-4">{r.activeMissions}</td>
                  <td className="py-2 pr-4">{r.openTasks}</td>
                  <td className="py-2 pr-4">{r.openOpps}</td>
                  <td className="py-2 pr-4">{pct(r.visibility)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        className="mt-6"
        title="Revenue attribution"
        description="ROI of AI-search fixes, mapped to revenue."
      >
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-line bg-surface/50 p-4">
          <IndianRupee className="mt-0.5 h-5 w-5 text-muted" />
          <div>
            <p className="text-sm font-medium text-ink">Not yet enabled</p>
            <p className="mt-1 text-sm text-muted">
              Connect Razorpay and GA4 to attribute revenue to visibility gains. Once the
              revenue pipeline is migrated, this card will show attributed revenue per brand and
              per mission.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
