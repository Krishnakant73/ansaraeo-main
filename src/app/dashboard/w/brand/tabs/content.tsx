import { createClient } from "@/lib/supabase/server";
import ContentStudioClient from "@/app/dashboard/content/ContentStudioClient";
import type { Brand } from "@/lib/selected-brand";

// ============================================================
// Brand › Content — Content Studio scoped to this brand.
// Extracts the same body that lives under /b/[slug]/content/page.tsx
// so both URLs render identical content (see workspace README).
// ============================================================

export default async function ContentBody({ brand }: { brand: Brand }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", brand.id);
  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase
        .from("visibility_runs")
        .select("prompt_id, brand_mentioned")
        .in("prompt_id", promptIds)
    : { data: [] };

  // A prompt is a "gap" if it has at least one run and NONE mention the brand.
  const runsByPrompt = new Map<string, boolean[]>();
  for (const r of runs ?? []) {
    if (!runsByPrompt.has(r.prompt_id)) runsByPrompt.set(r.prompt_id, []);
    runsByPrompt.get(r.prompt_id)!.push(r.brand_mentioned ?? false);
  }
  const gapPrompts = (prompts ?? []).filter((p) => {
    const results = runsByPrompt.get(p.id);
    return results && results.length > 0 && results.every((m) => !m);
  });

  const { data: contentItems } = await supabase
    .from("content_items")
    .select("id, title, status, created_at")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Content Studio</h2>
        <p className="mt-1 text-sm text-muted">
          AI drafts content aimed at your visibility gaps. Nothing publishes
          without your review.
        </p>
      </div>
      <ContentStudioClient gapPrompts={gapPrompts} contentItems={contentItems ?? []} />
    </div>
  );
}
