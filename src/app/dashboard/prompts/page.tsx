import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PromptsClient from "./PromptsClient";

export default async function PromptsPage() {
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

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, language")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Prompts — {brand.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Add prompts to track, then click &ldquo;Run check now&rdquo; to query ChatGPT live and store the result.
      </p>
      <div className="mt-6">
        <PromptsClient brandId={brand.id} prompts={prompts ?? []} />
      </div>
    </div>
  );
}
