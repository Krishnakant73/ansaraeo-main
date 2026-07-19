import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import CompetitorIntelClient from "@/app/dashboard/competitors/intelligence/CompetitorIntelClient";

export const dynamic = "force-dynamic";

export default async function CompetitorIntelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
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
          <Link href={`/dashboard/b/${slug}/competitors`} className="text-accent underline">
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
