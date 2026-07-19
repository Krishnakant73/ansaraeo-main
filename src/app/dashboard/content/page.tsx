import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import ContentStudioClient from "./ContentStudioClient";

export default async function ContentStudioPage() {
  const supabase = await createClient();
  const { data: brands } = await supabase.from("brands").select("id, name").limit(1);
  const brand = brands?.[0];

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
