import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Recommendations. Reads opportunity_recommendations
// filtered by competitor_id (migration 028) or by name mention in
// the title / detail JSON. Ranks by priority_score desc.
//
// Real column shape: id, brand_id, type, title, detail (jsonb),
// estimated_impact (jsonb), priority_score, status, prompt_id,
// competitor_id, created_at.
// ============================================================

type Detail = { rationale?: string; effort?: string; impact?: string } & Record<string, unknown>;

type Recommendation = {
  id: string;
  type: string;
  title: string;
  detail: Detail | null;
  estimated_impact: Record<string, unknown> | null;
  priority_score: number | null;
  status: string;
  competitor_id: string | null;
  prompt_id: string | null;
  created_at: string;
};

export default async function RecommendationsBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunity_recommendations")
    .select("*")
    .eq("brand_id", competitor.brand_id)
    .order("priority_score", { ascending: false })
    .limit(80);

  const rows = ((data as Recommendation[] | null) ?? []).filter((r) => {
    if (r.competitor_id === competitor.id) return true;
    const nameLower = competitor.name.toLowerCase();
    if (r.title.toLowerCase().includes(nameLower)) return true;
    if (r.detail && typeof r.detail === "object") {
      const values = Object.values(r.detail).filter(
        (v): v is string => typeof v === "string",
      );
      if (values.some((v) => v.toLowerCase().includes(nameLower))) return true;
    }
    return false;
  });

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <Intro competitor={competitor} />
        <EmptyStateCoach
          title="No recommendations yet"
          description={`We'll generate targeted moves once we have enough run data on ${competitor.name}. Nightly job populates these; you can also hit "Attack this" on any prompt where they beat you.`}
          action={{
            label: "Open Prompt Dominance",
            href: `/dashboard/w/competitor/${competitor.id}/prompts`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Intro competitor={competitor} />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.slice(0, 20).map((r) => (
          <RecommendationCard key={r.id} rec={r} brandSlug={competitor.brand.slug} />
        ))}
      </div>
    </div>
  );
}

function Intro({ competitor }: { competitor: Competitor }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-ink">Recommendations</h2>
      <p className="mt-1 text-sm text-muted">
        Ranked moves against {competitor.name}. Priority score first, then age.
      </p>
    </div>
  );
}

function RecommendationCard({
  rec,
  brandSlug,
}: {
  rec: Recommendation;
  brandSlug: string;
}) {
  const rationale =
    (rec.detail && typeof rec.detail === "object" && typeof rec.detail.rationale === "string"
      ? rec.detail.rationale
      : null) ?? null;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <header className="flex items-start gap-2">
        <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{rec.title}</h3>
          {rationale && <p className="mt-1 line-clamp-3 text-xs text-muted">{rationale}</p>}
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {rec.priority_score != null && (
          <span className="chip">Priority {Math.round(rec.priority_score)}</span>
        )}
        <span className="chip capitalize">{rec.type.replace(/_/g, " ")}</span>
        <span
          className={`chip ${
            rec.status === "done"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : rec.status === "dismissed"
                ? "border-line bg-surface text-muted"
                : "border-accent/20 bg-accent/10 text-accent"
          }`}
        >
          {rec.status}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Link href={`/dashboard/w/opportunity/${rec.id}/overview`} className="btn-xs btn-xs-accent">
          Open
        </Link>
        <Link href={`/dashboard/b/${brandSlug}/opportunities`} className="btn-xs btn-xs-ghost">
          All opportunities
        </Link>
      </div>
    </article>
  );
}
