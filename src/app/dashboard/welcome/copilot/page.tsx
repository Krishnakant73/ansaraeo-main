import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { proposeFirstDraft, type GoalKey } from "@/lib/copilot-proposals";
import { CopilotIntroActions } from "@/components/onboarding/CopilotIntroActions";
import { logActivationEvent } from "@/lib/activation-events";
import { Sparkles } from "lucide-react";

// ============================================================
// /dashboard/welcome/copilot — the Copilot intro.
//
// A single-message intro, grounded in a real "most invisible" prompt.
// Primary CTA: draft the first task. Secondary CTA: show all three
// (route to a task queue page — for MVP, that's just Mission Control).
// ============================================================

export const dynamic = "force-dynamic";

async function pickMostInvisiblePrompt(brandId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data: prompts } = await svc.from("prompts").select("id, text").eq("brand_id", brandId);
  if (!prompts?.length) return null;
  const promptIds = prompts.map((p) => p.id);
  const { data: runs } = await svc
    .from("visibility_runs")
    .select("prompt_id, brand_mentioned")
    .in("prompt_id", promptIds);

  // Count mentions per prompt; pick the prompt with the most runs where
  // the brand is NOT mentioned. Tie-break by shortest prompt (more
  // canonical / easier to publish for).
  const byPrompt = new Map<string, { total: number; missed: number }>();
  for (const p of prompts) byPrompt.set(p.id, { total: 0, missed: 0 });
  for (const r of runs ?? []) {
    const e = byPrompt.get(r.prompt_id);
    if (!e) continue;
    e.total += 1;
    if (!r.brand_mentioned) e.missed += 1;
  }

  const ranked = prompts
    .map((p) => ({ ...p, ...(byPrompt.get(p.id) ?? { total: 0, missed: 0 }) }))
    .filter((p) => p.total === 0 || p.missed >= p.total) // never mentioned in what we've tested
    .sort((a, b) => b.missed - a.missed || a.text.length - b.text.length);

  return ranked[0]?.text ?? prompts[0].text;
}

export default async function CopilotIntroPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string; scan?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { brand } = await getSelectedBrand();
  if (!brand) redirect("/dashboard/onboarding");

  const { goal: goalParam } = await searchParams;
  const goal: GoalKey = (goalParam === "beat_competitor" || goalParam === "fix_site" ? goalParam : "chatgpt_mentions") as GoalKey;

  const mostInvisible = await pickMostInvisiblePrompt(brand.id);
  const proposal = proposeFirstDraft({
    brandName: brand.name,
    mostInvisiblePrompt: mostInvisible,
    goal,
  });

  await logActivationEvent({
    event: "first_task_proposed",
    userId: user.id,
    brandId: brand.id,
    payload: { goal, mostInvisible },
  });

  return (
    <div className="mx-auto max-w-2xl py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Step 2 of 2</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
        Meet your Copilot.
      </h1>

      <div className="mt-10 card p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">AEO Copilot</p>
            <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-ink">{proposal.text}</p>
          </div>
        </div>

        <CopilotIntroActions
          brandId={brand.id}
          goal={goal}
          hasPrompt={Boolean(mostInvisible)}
          primaryCta={proposal.cta}
        />
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Prefer to skip ahead?{" "}
        <Link href="/dashboard/mission-control" className="font-medium text-accent">
          Go to Mission Control
        </Link>
      </p>
    </div>
  );
}
