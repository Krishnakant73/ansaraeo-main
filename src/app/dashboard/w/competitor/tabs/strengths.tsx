import Link from "next/link";
import { AlertTriangle, Shield, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach, EvidenceChip } from "@/workspace/primitives";
import { deriveCompetitorTraits, type CompetitorTrait } from "@/lib/competitor-traits";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Strengths — non-fabricated cards. Each is backed by
// evidence_run_ids from visibility_runs and the deterministic
// deriveCompetitorTraits() reconciler. Below-threshold confidence
// (< 0.6) reads as "Suspected" and greyscales; nothing invented.
// ============================================================

export default async function StrengthsBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traits = await deriveCompetitorTraits(supabase as any, {
    id: competitor.id,
    brand_id: competitor.brand_id,
    name: competitor.name,
    domain: competitor.domain,
  });
  const strengths = traits.filter((t) => t.dimension === "strength");

  if (strengths.length === 0) {
    return (
      <div className="space-y-4">
        <TabIntro
          title="Strengths"
          desc={`Where ${competitor.name} beats you, ranked by threat contribution. Each card traces to backing runs.`}
        />
        <EmptyStateCoach
          title="No strengths derived yet"
          description="We need at least a few visibility runs where this competitor appears to compute strengths. Run a scan or wait for the nightly cron."
          action={{
            label: "Run visibility scan",
            href: `/dashboard/b/${competitor.brand.slug}/visibility`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TabIntro
        title="Strengths"
        desc={`Where ${competitor.name} beats you, ranked by threat contribution. Each card traces to backing runs.`}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {strengths.map((t) => (
          <TraitCard
            key={`${t.dimension}-${t.label}`}
            trait={t}
            brandSlug={competitor.brand.slug}
            competitorId={competitor.id}
          />
        ))}
      </div>
    </div>
  );
}

function TabIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{desc}</p>
    </div>
  );
}

export function TraitCard({
  trait,
  brandSlug,
  competitorId,
}: {
  trait: CompetitorTrait;
  brandSlug: string;
  competitorId: string;
}) {
  const isStrength = trait.dimension === "strength";
  const suspected = trait.confidence < 0.6;
  const Icon = isStrength ? Zap : Shield;

  const beatableCopy: Record<string, string> = {
    easy: "Easy — a small piece of content likely flips this.",
    medium: "Medium — a focused push over a sprint should close it.",
    hard: "Hard — expect months of compounding work.",
  };

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${
        suspected
          ? "border-line/60 bg-white/60 grayscale"
          : isStrength
            ? "border-rose-100 bg-rose-50/40"
            : "border-emerald-100 bg-emerald-50/40"
      }`}
      aria-label={`${isStrength ? "Strength" : "Weakness"}: ${trait.label}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            aria-hidden
            className={`h-4 w-4 shrink-0 ${isStrength ? "text-rose-700" : "text-emerald-700"}`}
          />
          <h3 className="truncate text-sm font-semibold text-ink">{trait.label}</h3>
        </div>
        <span className="chip shrink-0 text-[10px]">
          conf {trait.confidence.toFixed(2)}
          {suspected && <span className="ml-1 text-muted">(suspected)</span>}
        </span>
      </header>
      <p className="text-sm text-ink/85">{trait.description}</p>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <EvidenceChip
          parts={[`${trait.evidence_count} run${trait.evidence_count === 1 ? "" : "s"}`]}
          href={`/dashboard/b/${brandSlug}/visibility?competitor=${competitorId}`}
          label={`Evidence for ${trait.label}`}
        />
        {trait.beatable && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-muted"
            title={beatableCopy[trait.beatable]}
          >
            <AlertTriangle aria-hidden className="h-3 w-3" />
            Beatable: {trait.beatable}
          </span>
        )}
      </div>
      {!isStrength && (
        <div className="pt-1">
          <Link
            href={`/dashboard/b/${brandSlug}/content?exploit=${encodeURIComponent(trait.label)}&competitor=${competitorId}`}
            className="btn-xs btn-xs-accent"
          >
            Draft in Studio
          </Link>
        </div>
      )}
    </article>
  );
}
