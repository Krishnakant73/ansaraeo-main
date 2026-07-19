// ============================================================
// feature-unlock — pure function that decides which product areas
// are visible to a user today.
//
// The design principle from the redesign: features are surfaced when
// they become relevant, not gated behind grey-locked padlocks. A user
// who hasn't shipped a first draft doesn't see the Answer Blocks nav
// item because it isn't useful to them yet, not because they haven't
// paid.
//
// Paid limits are volume-based (prompts tracked, brands, scan
// frequency) and live in the existing `plan_limits` table — this
// module does NOT gate paid features. It gates *relevance*.
// ============================================================

export type FeatureKey =
  // Always available
  | "mission_control"
  | "visibility"
  | "competitors"
  | "settings"
  | "prompts"
  // Unlocked by a first published draft
  | "answer_blocks"
  | "geo_linter"
  | "schema_for_ai"
  | "content_optimizer"
  // Unlocked by first mention detected
  | "citations"
  | "citation_network"
  // Unlocked by week 2
  | "site_audit"
  | "ai_index"
  | "llms_txt"
  | "robots_check"
  // Unlocked by month 2
  | "revenue_attribution"
  | "gsc"
  | "gbp"
  | "benchmark"
  // Enterprise / agency
  | "agency"
  | "campaigns"
  | "playbooks";

export type UnlockContext = {
  createdAt: Date; // brand.created_at as a proxy for user tenure
  events: Set<string>; // activation_events.event values for the user
  orgMode: "solo" | "agency" | "enterprise";
};

const ALWAYS_AVAILABLE: FeatureKey[] = [
  "mission_control",
  "visibility",
  "competitors",
  "settings",
  "prompts",
];

const DAY = 24 * 60 * 60 * 1000;

export function getUnlockedFeatures(ctx: UnlockContext): Set<FeatureKey> {
  const set = new Set<FeatureKey>(ALWAYS_AVAILABLE);
  const ageDays = (Date.now() - ctx.createdAt.getTime()) / DAY;

  // First published draft unlocks the content-crafting tools.
  if (ctx.events.has("first_draft_published") || ctx.events.has("first_draft_saved")) {
    set.add("answer_blocks");
    set.add("geo_linter");
    set.add("schema_for_ai");
    set.add("content_optimizer");
  }

  // First mention detected unlocks the citation-analysis modules.
  if (ctx.events.has("first_mention_detected")) {
    set.add("citations");
    set.add("citation_network");
  }

  // Week 2 unlocks the site-technical modules — a first-week user isn't
  // ready to think about llms.txt yet, and clutter kills adoption.
  if (ageDays >= 7 || ctx.events.has("scan_hydrated")) {
    set.add("site_audit");
  }
  if (ageDays >= 14) {
    set.add("ai_index");
    set.add("llms_txt");
    set.add("robots_check");
  }

  // Month 2 unlocks the outcome/revenue side.
  if (ageDays >= 30) {
    set.add("revenue_attribution");
    set.add("gsc");
    set.add("gbp");
    set.add("benchmark");
  }

  // Agency mode surfaces the agency + client tooling.
  if (ctx.orgMode === "agency" || ctx.orgMode === "enterprise") {
    set.add("agency");
    set.add("campaigns");
    set.add("playbooks");
  }

  return set;
}
