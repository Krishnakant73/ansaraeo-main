import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import PromptsClient from "./PromptsClient";

export default async function PromptsPage() {
  const supabase = await createClient();
  const { data: brands } = await supabase.from("brands").select("id, name").limit(1);
  const brand = brands?.[0];

  if (!brand) {
    return (
      <div>
        <PageHeader title="Prompts" subtitle="Track the questions that matter to your brand" />
        <div className="empty">
          <p className="text-sm text-muted">Set up a brand first to start tracking prompts.</p>
          <Link href="/dashboard/onboarding" className="btn-primary mt-5">
            Start setup
          </Link>
        </div>
      </div>
    );
  }

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, language, intent")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Prompts"
        subtitle={`Questions you track for ${brand.name}`}
      />
      <PromptsClient brandId={brand.id} prompts={prompts ?? []} />
    </div>
  );
}
