import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import CompetitorIntelClient from "./CompetitorIntelClient";

export default async function CompetitorIntelPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">Set up a brand first.</p>
        <Link href="/dashboard/onboarding" className="btn-primary mt-4 inline-flex">
          Start setup
        </Link>
      </div>
    );
  }

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id")
    .eq("brand_id", brand.id)
    .eq("confirmed", true);
  const { data: prompts } = await supabase.from("prompts").select("id").eq("brand_id", brand.id);
  const promptIds = (prompts ?? []).map((p) => p.id);
  const { data: runs } = promptIds.length
    ? await supabase.from("visibility_runs").select("id").in("prompt_id", promptIds).limit(1)
    : { data: [] };

  const ready = (competitors?.length ?? 0) > 0 && (runs?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Competitor Intelligence"
        subtitle="Find where competitors get cited instead of you, and generate side-by-side battlecards."
      />
      {!ready ? (
        <Panel className="mt-6" bodyClassName="text-sm text-muted p-5">
          Run a few visibility checks with confirmed competitors first — both features need run history to work.{" "}
          <Link href="/dashboard/competitors" className="text-accent underline">
            Manage competitors
          </Link>
          .
        </Panel>
      ) : (
        <CompetitorIntelClient brandId={brand.id} brandName={brand.name} />
      )}
    </div>
  );
}
