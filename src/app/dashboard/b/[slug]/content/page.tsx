import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import ContentStudioClient from "@/app/dashboard/content/ContentStudioClient";

export const dynamic = "force-dynamic";

export default async function ContentStudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brand.id);
  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase.from("visibility_runs").select("prompt_id, brand_mentioned").in("prompt_id", promptIds)
    : { data: [] };

  // A prompt is a "gap" if it has at least one run and NONE of them mention the brand
  const runsByPrompt = new Map<string, boolean[]>();
  for (const r of runs ?? []) {
    if (!runsByPrompt.has(r.prompt_id)) runsByPrompt.set(r.prompt_id, []);
    runsByPrompt.get(r.prompt_id)!.push(r.brand_mentioned ?? false);
  }
  const gapPrompts = (prompts ?? []).filter((p) => {
    const results = runsByPrompt.get(p.id);
    return results && results.length > 0 && results.every((mentioned) => !mentioned);
  });

  const { data: contentItems } = await supabase
    .from("content_items")
    .select("id, title, status, created_at")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title={`Content Studio — ${brand.name}`}
        subtitle="AI drafts content aimed at your visibility gaps. Nothing publishes without your review."
      />
      <div className="mt-6">
        <ContentStudioClient gapPrompts={gapPrompts} contentItems={contentItems ?? []} />
      </div>
    </div>
  );
}
