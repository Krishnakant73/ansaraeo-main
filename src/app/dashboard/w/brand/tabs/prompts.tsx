import { createClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import PromptsClient from "@/app/dashboard/prompts/PromptsClient";

// ============================================================
// Brand workspace › Prompts tab body.
//
// Body-only component consumed by both the workspace tab render() and
// the /dashboard/b/[slug]/prompts thin-wrapper page. Owns no auth or
// brand-resolution logic — the caller already resolved the brand.
// ============================================================

export default async function PromptsBody({ brand }: { brand: Brand }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, language, intent")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title="Prompts" subtitle={`Questions you track for ${brand.name}`} />
      <PromptsClient brandId={brand.id} prompts={prompts ?? []} />
    </div>
  );
}
