import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Competitor } from "@/lib/competitor-workspace";
import OpportunityRadar from "../features/OpportunityRadar";
import BattlePlanBoard from "./BattlePlanBoard.client";

// ============================================================
// Competitor › Battle Plan — server data + client board with DnD.
// Lanes derived from opportunity_recommendations.status:
//   in_progress → Now
//   open        → Next
//   snoozed     → Later
// done + dismissed do not show in the board (they live in the
// opportunity workspace's history tab instead).
// ============================================================

type LaneKey = "now" | "next" | "later";

type Recommendation = {
  id: string;
  brand_id: string;
  type: string;
  title: string;
  detail: { rationale?: string } | null;
  priority_score: number | null;
  status: string;
  competitor_id: string | null;
  prompt_id: string | null;
  created_at: string;
};

const STATUS_TO_LANE: Record<string, LaneKey | null> = {
  in_progress: "now",
  open: "next",
  snoozed: "later",
  done: null,
  dismissed: null,
};

export default async function BattlePlanBody({ competitor }: { competitor: Competitor }) {
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

  const lanes: Record<LaneKey, {
    id: string;
    title: string;
    rationale: string | null;
    status: string;
    priority_score: number | null;
    type: string;
  }[]> = { now: [], next: [], later: [] };

  for (const r of rows) {
    const lane = STATUS_TO_LANE[r.status];
    if (!lane) continue;
    const rationale =
      r.detail && typeof r.detail === "object" && typeof r.detail.rationale === "string"
        ? r.detail.rationale
        : null;
    lanes[lane].push({
      id: r.id,
      title: r.title,
      rationale,
      status: r.status,
      priority_score: r.priority_score,
      type: r.type,
    });
  }

  const hasAny = lanes.now.length + lanes.next.length + lanes.later.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Battle Plan</h2>
          <p className="mt-1 text-sm text-muted">
            The moves that close the gap. Drag between lanes or use the Move buttons.
          </p>
        </div>
        <Link
          href={`/dashboard/b/${competitor.brand.slug}/opportunities`}
          className="btn-sm inline-flex items-center gap-1.5"
        >
          <PlayCircle aria-hidden className="h-3.5 w-3.5" /> Manage all
        </Link>
      </div>

      <OpportunityRadar competitor={competitor} />

      {!hasAny ? (
        <EmptyStateCoach
          title="No battle plan yet"
          description={`Accept an opportunity or hit "Attack this" on a prompt where ${competitor.name} beats you. Cards land here pinned to this competitor.`}
          action={{
            label: "Open Prompt Dominance",
            href: `/dashboard/w/competitor/${competitor.id}/prompts`,
          }}
        />
      ) : (
        <BattlePlanBoard initial={lanes} />
      )}
    </div>
  );
}
