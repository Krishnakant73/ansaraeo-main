import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import ShareOfVoiceChart from "./ShareOfVoiceChart";
import CompetitorsManager from "./CompetitorsManager";

export default async function CompetitorsPage() {
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

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name, confirmed, source")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: true });

  const { data: prompts } = await supabase.from("prompts").select("id").eq("brand_id", brand.id);
  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase.from("visibility_runs").select("brand_mentioned, competitor_mentions").in("prompt_id", promptIds)
    : { data: [] };

  const totalRuns = runs?.length ?? 0;

  // Share of Voice: brand's own mention rate...
  const brandMentions = runs?.filter((r) => r.brand_mentioned).length ?? 0;
  const voiceData = [
    {
      name: brand.name,
      value: totalRuns > 0 ? Math.round((brandMentions / totalRuns) * 100) : 0,
      isYou: true,
    },
  ];

  // ...plus each confirmed competitor's mention rate, computed from the
  // competitor_mentions JSONB stored on every run (Migration 007).
  for (const comp of (competitors ?? []).filter((c) => c.confirmed)) {
    let mentionedCount = 0;
    for (const run of runs ?? []) {
      const mentions = (run.competitor_mentions ?? []) as { name: string; mentioned: boolean }[];
      if (mentions.find((m) => m.name.toLowerCase() === comp.name.toLowerCase())?.mentioned) {
        mentionedCount += 1;
      }
    }
    voiceData.push({
      name: comp.name,
      value: totalRuns > 0 ? Math.round((mentionedCount / totalRuns) * 100) : 0,
      isYou: false,
    });
  }

  voiceData.sort((a, b) => b.value - a.value);

  return (
    <div>
      <PageHeader
        title={`Competitors — ${brand.name}`}
        subtitle="Share of Voice across every tracked prompt and engine."
      />

      <Panel
        title="Share of Voice"
        description="How often your brand and each competitor are cited across all runs."
      >
        <ShareOfVoiceChart data={voiceData} />
        {totalRuns === 0 && (
          <p className="mt-2 text-center text-xs text-muted">
            Run some visibility checks first, then this chart fills in automatically.
          </p>
        )}
      </Panel>

      <Panel
        title="Manage competitors"
        description="Auto-discover uses AI to suggest real competitors — you confirm or reject each one before it's tracked."
        className="mt-6"
      >
        <CompetitorsManager brandId={brand.id} competitors={competitors ?? []} />
      </Panel>
    </div>
  );
}
