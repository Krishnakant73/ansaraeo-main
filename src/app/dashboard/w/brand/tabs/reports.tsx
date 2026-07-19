import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand, type Brand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import DownloadReportButton from "@/app/dashboard/reports/DownloadReportButton";

export default async function ReportsBody({ brand }: { brand: Brand }) {
  // getSelectedBrand gives us allBrands (the org's full portfolio) for
  // the portfolio table. The `.brand` it returns is cookie-based and
  // ignored here — the URL/workspace loader is the source of truth.
  const { allBrands } = await getSelectedBrand();
  const supabase = await createClient();

  const portfolio = await Promise.all(
    allBrands.map(async (b) => {
      const { data: prompts } = await supabase.from("prompts").select("id").eq("brand_id", b.id);
      const promptIds = (prompts ?? []).map((p) => p.id);
      const { data: runs } = promptIds.length
        ? await supabase.from("visibility_runs").select("brand_mentioned").in("prompt_id", promptIds)
        : { data: [] };
      const total = runs?.length ?? 0;
      const mentioned = runs?.filter((r) => r.brand_mentioned).length ?? 0;
      return {
        id: b.id,
        slug: b.slug,
        name: b.name,
        score: total > 0 ? Math.round((mentioned / total) * 100) : null,
        promptCount: prompts?.length ?? 0,
        runCount: total,
      };
    }),
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Portfolio view across every brand you manage, plus downloadable branded reports."
      />

      {allBrands.length > 1 && (
        <Panel
          title="Portfolio visibility"
          description="Aggregate visibility score across every brand you manage."
          bodyClassName="overflow-x-auto p-0"
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Brand</th>
                <th className="px-5 py-3 font-medium">Visibility Score</th>
                <th className="px-5 py-3 font-medium">Prompts</th>
                <th className="px-5 py-3 font-medium">Runs</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((p) => (
                <tr key={p.id} className="border-t border-line/60">
                  <td className="px-5 py-3 font-medium">
                    <a href={`/dashboard/b/${p.slug}/reports`} className="hover:text-accent hover:underline">
                      {p.name}
                    </a>
                  </td>
                  <td className="px-5 py-3">{p.score !== null ? `${p.score}%` : "—"}</td>
                  <td className="px-5 py-3">{p.promptCount}</td>
                  <td className="px-5 py-3">{p.runCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel
        title={`Download report — ${brand.name}`}
        description="A branded PDF with visibility score, per-engine breakdown, Share of Voice, and recent prompt results — ready to forward to a client."
        className={allBrands.length > 1 ? "mt-6" : undefined}
      >
        <DownloadReportButton brandId={brand.id} />
      </Panel>
    </div>
  );
}
