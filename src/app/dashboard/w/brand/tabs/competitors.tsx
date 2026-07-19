import { createClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import ShareOfVoiceChart from "@/app/dashboard/competitors/ShareOfVoiceChart";
import CompetitorsManager from "@/app/dashboard/competitors/CompetitorsManager";

export default async function CompetitorsBody({ brand }: { brand: Brand }) {
  const supabase = await createClient();

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name, confirmed, source")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: true });

  const { data: prompts } = await supabase.from("prompts").select("id").eq("brand_id", brand.id);
  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase
        .from("visibility_runs")
        .select("brand_mentioned, competitor_mentions")
        .in("prompt_id", promptIds)
    : { data: [] };

  const totalRuns = runs?.length ?? 0;

  const brandMentions = runs?.filter((r) => r.brand_mentioned).length ?? 0;
  const voiceData = [
    {
      name: brand.name,
      value: totalRuns > 0 ? Math.round((brandMentions / totalRuns) * 100) : 0,
      isYou: true,
    },
  ];

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

  const sovByName: Record<string, number> = {};
  for (const v of voiceData) {
    if (!v.isYou) sovByName[v.name] = v.value;
  }

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
        <CompetitorsManager brandId={brand.id} competitors={competitors ?? []} shareOfVoice={sovByName} />
      </Panel>
    </div>
  );
}
