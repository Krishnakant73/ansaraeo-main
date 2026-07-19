import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import ConsistencyClient from "@/app/dashboard/consistency/ConsistencyClient";

export const dynamic = "force-dynamic";

export default async function ConsistencyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", brand.id)
    .limit(100);

  return (
    <ConsistencyClient
      brandId={brand.id}
      prompts={prompts ?? []}
      engines={["chatgpt", "perplexity", "gemini", "grok", "copilot"]}
    />
  );
}
