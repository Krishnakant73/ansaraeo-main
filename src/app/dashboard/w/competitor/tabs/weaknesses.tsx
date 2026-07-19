import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import { deriveCompetitorTraits } from "@/lib/competitor-traits";
import { TraitCard } from "./strengths";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Weaknesses — the exploit side of the trait matrix.
// Same TraitCard used on the Strengths tab, filtered to dimension
// = weakness. Each carries a "Draft in Studio" affordance so the
// analysis-to-action loop stays one click.
// ============================================================

export default async function WeaknessesBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traits = await deriveCompetitorTraits(supabase as any, {
    id: competitor.id,
    brand_id: competitor.brand_id,
    name: competitor.name,
    domain: competitor.domain,
  });
  const weaknesses = traits.filter((t) => t.dimension === "weakness");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Weaknesses</h2>
        <p className="mt-1 text-sm text-muted">
          Where {competitor.name} is exposed. Each card comes with the exact move that exploits it.
        </p>
      </div>

      {weaknesses.length === 0 ? (
        <EmptyStateCoach
          title="No weaknesses found yet"
          description="Either we haven't seen enough runs, or this competitor is well-defended across the prompts you track."
          action={{
            label: "Add more prompts",
            href: `/dashboard/b/${competitor.brand.slug}/prompts`,
          }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {weaknesses.map((t) => (
            <TraitCard
              key={`${t.dimension}-${t.label}`}
              trait={t}
              brandSlug={competitor.brand.slug}
              competitorId={competitor.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
