import { createClient } from "@/lib/supabase/server";
import { PenSquare, Wrench, FileText, Layers } from "lucide-react";
import Link from "next/link";
import type { Prompt } from "@/lib/prompt-workspace";

// ============================================================
// Prompt › Optimization — prescriptive fixes for THIS prompt.
// Deep-links into the brand's Content Studio pre-filtered on the
// prompt, and shows deterministic fanout / answer-block CTAs.
// Every generator listed here honors the repo's honesty design —
// drafts, not final content, with [ADD ...] placeholders.
// ============================================================

export default async function OptimizationBody({ prompt }: { prompt: Prompt }) {
  const supabase = await createClient();

  // Does this prompt have any content_items linked already?
  const { data: linked } = await supabase
    .from("content_items")
    .select("id, title, status, created_at")
    .eq("brand_id", prompt.brand_id)
    .eq("prompt_id", prompt.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const items = (linked as { id: string; title: string; status: string; created_at: string }[] | null) ?? [];

  // How many recent runs of this prompt failed to mention the brand?
  const { data: recent } = await supabase
    .from("visibility_runs")
    .select("brand_mentioned")
    .eq("prompt_id", prompt.id)
    .order("run_at", { ascending: false })
    .limit(30);
  const rows = (recent as { brand_mentioned: boolean | null }[] | null) ?? [];
  const nonSkipped = rows.filter((r) => r.brand_mentioned !== null);
  const missed = nonSkipped.filter((r) => r.brand_mentioned === false).length;
  const gap = nonSkipped.length > 0 ? Math.round((missed / nonSkipped.length) * 100) : 0;

  const contentHref = `/dashboard/w/brand/${prompt.brand.slug}/content?promptId=${prompt.id}`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Optimization</h2>
        <p className="mt-1 text-sm text-muted">
          Prescriptive fixes to earn a mention for this prompt. Every draft ships with
          <code className="mx-1 rounded bg-surface px-1 text-[11px]">[ADD ...]</code>
          placeholders — nothing is invented on {prompt.brand.name}&rsquo;s behalf.
        </p>
      </div>

      {gap > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="section-label text-amber-700">Gap detected</p>
          <p className="mt-1 text-sm text-ink">
            {missed} of the last {nonSkipped.length} runs didn&rsquo;t mention {prompt.brand.name}{" "}
            ({gap}%). The generators below produce content that gives engines a reason to cite you.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Card
          icon={PenSquare}
          title="Draft an answer block"
          body="An answer-block is a short, citable Q&A card that AI engines pick up. Drafted from this prompt's intent, phrased for direct citation."
          href={contentHref}
          cta="Open Content Studio"
        />
        <Card
          icon={Layers}
          title="Fanout coverage"
          body="Does your site answer every sub-question of this prompt? Runs deterministic gap analysis to list the missing angles."
          href={`/dashboard/b/${prompt.brand.slug}/fanout-coverage?promptId=${prompt.id}`}
          cta="Run fanout"
        />
        <Card
          icon={FileText}
          title="Content gap"
          body="Suggest new pages that would win this prompt — with title, intent, and target sections."
          href={`/dashboard/b/${prompt.brand.slug}/content-gap?promptId=${prompt.id}`}
          cta="Analyze gaps"
        />
        <Card
          icon={Wrench}
          title="GEO rewrite"
          body="Take an AI answer that missed you and produce a rewrite of your own page tuned to earn the mention next time."
          href={`/dashboard/b/${prompt.brand.slug}/geo-linter?promptId=${prompt.id}`}
          cta="Open GEO linter"
        />
      </div>

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="section-label">Content linked to this prompt</p>
          <span className="text-xs text-muted">{items.length} item{items.length === 1 ? "" : "s"}</span>
        </div>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No content is linked to this prompt yet. Draft one from any generator above.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="truncate text-ink">{it.title}</span>
                <span className="chip">{it.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  body,
  href,
  cta,
}: {
  icon: typeof Wrench;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" aria-hidden />
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <p className="text-xs text-muted">{body}</p>
      <Link href={href} className="btn-ghost mt-1 self-start text-xs">
        {cta} →
      </Link>
    </div>
  );
}
