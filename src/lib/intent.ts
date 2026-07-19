// Prompt intent taxonomy — the funnel-stage-aware classification layer.
//
// Different metrics matter at different funnel stages. Awareness queries care
// about visibility rate; decision-stage queries (comparison / best-choice /
// purchase) care about rank, citation share, and recommendation quality.
//
// This is a single source of truth. The `prompts.intent` column stores a
// canonical key; `category` remains a free-form sub-label. The starter-prompt
// generator and the Prompt Suite produce groups that we map onto these keys.

export type IntentKey =
  | "awareness"
  | "comparison"
  | "best_choice"
  | "problem_solving"
  | "local_intent"
  | "purchase_intent"
  | "branded";

export type FunnelStage = "top" | "middle" | "bottom";

export type IntentDef = {
  key: IntentKey;
  label: string;
  funnelStage: FunnelStage;
  description: string;
};

export const INTENTS: IntentDef[] = [
  {
    key: "awareness",
    label: "Awareness",
    funnelStage: "top",
    description: "Is the brand known for this topic at all?",
  },
  {
    key: "comparison",
    label: "Comparison",
    funnelStage: "middle",
    description: "How does the brand stack up against alternatives?",
  },
  {
    key: "best_choice",
    label: "Best choice",
    funnelStage: "middle",
    description: "Is the brand named as the best option?",
  },
  {
    key: "problem_solving",
    label: "Problem solving",
    funnelStage: "middle",
    description: "Does the brand solve the underlying problem?",
  },
  {
    key: "local_intent",
    label: "Local intent",
    funnelStage: "bottom",
    description: "Is the brand recommended near the user?",
  },
  {
    key: "purchase_intent",
    label: "Purchase intent",
    funnelStage: "bottom",
    description: "Is the brand recommended at the point of purchase?",
  },
  {
    key: "branded",
    label: "Branded query",
    funnelStage: "bottom",
    description: "When someone searches the brand by name, is it described correctly?",
  },
];

const INTENT_MAP = new Map<IntentKey, IntentDef>(INTENTS.map((i) => [i.key, i]));

// The canonical set, for validation (e.g. in the prompts API zod schema).
export const INTENT_KEYS: IntentKey[] = INTENTS.map((i) => i.key);

export function isIntentKey(value: unknown): value is IntentKey {
  return typeof value === "string" && (INTENT_KEYS as string[]).includes(value);
}

export function intentLabel(key: string | null | undefined): string {
  if (!key) return "Uncategorized";
  return INTENT_MAP.get(key as IntentKey)?.label ?? "Uncategorized";
}

export function intentFunnelStage(key: string | null | undefined): FunnelStage | null {
  if (!key) return null;
  return INTENT_MAP.get(key as IntentKey)?.funnelStage ?? null;
}

// Map the existing starter-prompt / prompt-suite groups onto canonical intents.
// Groups used across the product: recommend | compare | define | tutorial | alternative.
export function mapStarterGroupToIntent(group: string | null | undefined): IntentKey {
  switch ((group || "").toLowerCase()) {
    case "recommend":
      return "awareness";
    case "compare":
    case "alternative":
      return "comparison";
    case "define":
    case "tutorial":
      return "problem_solving";
    default:
      return "awareness";
  }
}

// Best-effort intent inference from prompt text, used when no explicit group is
// available (e.g. user pasted a prompt). Honest heuristic only — the user can
// always override the intent in the UI.
export function inferIntentFromText(text: string): IntentKey {
  const t = text.toLowerCase();
  if (/\b(best|top|leading|recommended|ideal)\b/.test(t)) return "best_choice";
  if (/\b(vs|versus|compared? to|or|alternative|instead of)\b/.test(t)) return "comparison";
  if (/\b(buy|price|pricing|cost|purchase|shop|order|coupon|deal)\b/.test(t)) return "purchase_intent";
  if (/\b(near me|in [a-z ]+|bangalore|mumbai|delhi|hyderabad|chennai|pune|kolkata|local)\b/.test(t))
    return "local_intent";
  if (/\b(how (do|to)|what is|what are|why|guide|tutorial|solve|fix|meaning)\b/.test(t))
    return "problem_solving";
  if (/\b(my brand|our brand|the brand|company name|official)\b/.test(t)) return "branded";
  return "awareness";
}
