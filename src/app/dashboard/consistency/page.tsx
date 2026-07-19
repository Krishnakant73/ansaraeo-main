import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import ConsistencyClient from "./ConsistencyClient";

export default async function Page() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) return <p className="text-sm text-muted">Set up a brand first.</p>;

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
