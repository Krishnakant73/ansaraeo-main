// ============================================================
// engine-optimization — deterministic recipe for "how to optimize
// for this specific AI." Not an LLM — a per-engine playbook derived
// from what the engine cares about (see engine-personality axes),
// materialized as concrete opportunity drafts.
//
// Each move is:
//   - kind        : stable slug used for idempotent upsert
//   - title       : one-line action
//   - rationale   : why THIS engine responds to this move
//   - impact      : {mentions_per_month, visibility_delta} — direction, not guarantee
//   - priority    : 0..100
//
// The API route materializes these into opportunity_recommendations
// rows keyed on (brand_id, type='engine_optimization', engine_id,
// detail.kind) so re-running the generator upserts, doesn't dupe.
// ============================================================

export type EngineOptimizationMove = {
  kind: string;
  title: string;
  rationale: string;
  impact: {
    mentions_per_month: number;
    visibility_delta: number;   // pp
  };
  priority: number;             // 0..100
};

// Per-engine recipe. Order in the array is the recommended sequence.
const RECIPES: Record<string, EngineOptimizationMove[]> = {
  chatgpt: [
    {
      kind: "faq-page-prescriptive",
      title: "Publish a prescriptive FAQ page for the top gap prompts",
      rationale:
        "ChatGPT favors clear directives (\"Use X for Y\") over hedged prose. A dedicated FAQ page with imperative answers is the shortest path to a mention.",
      impact: { mentions_per_month: 8, visibility_delta: 12 },
      priority: 88,
    },
    {
      kind: "comparison-table",
      title: "Ship a versus-comparison table page against the top competitor",
      rationale:
        "ChatGPT quotes comparison tables verbatim when asked \"Which is better, X or Y?\" — a good table plus a summary paragraph earns the mention.",
      impact: { mentions_per_month: 5, visibility_delta: 8 },
      priority: 78,
    },
    {
      kind: "structured-summary-hero",
      title: "Add a 3-bullet summary hero to your top landing pages",
      rationale:
        "The model reads the first 100 tokens of a page heavily. A 3-bullet product summary at the top improves the odds it becomes the answer.",
      impact: { mentions_per_month: 3, visibility_delta: 5 },
      priority: 65,
    },
  ],
  perplexity: [
    {
      kind: "guest-post-cluster",
      title: "Earn 3 citations on trusted-source domains for your key prompts",
      rationale:
        "Perplexity ranks by citation graph. A guest post on a domain the model already trusts is worth more than a page on your own site.",
      impact: { mentions_per_month: 10, visibility_delta: 18 },
      priority: 92,
    },
    {
      kind: "primary-source-page",
      title: "Publish an original primary-research page with an obvious citation slug",
      rationale:
        "Perplexity prefers original sources over aggregators. Include a stable citation slug so subsequent runs link the same URL.",
      impact: { mentions_per_month: 7, visibility_delta: 14 },
      priority: 82,
    },
    {
      kind: "citation-refresh",
      title: "Refresh the top-3 pages Perplexity already cites",
      rationale:
        "The model re-crawls known citations. A dated update on a page it already trusts is often enough to sustain the citation.",
      impact: { mentions_per_month: 4, visibility_delta: 6 },
      priority: 70,
    },
  ],
  gemini: [
    {
      kind: "faq-schema",
      title: "Add FAQPage + HowTo JSON-LD to your top intent pages",
      rationale:
        "Gemini heavily favors structured markup for surfacing answers. Well-formed FAQ / HowTo schema is the fastest lift.",
      impact: { mentions_per_month: 6, visibility_delta: 10 },
      priority: 85,
    },
    {
      kind: "step-by-step-guide",
      title: "Publish a step-by-step guide covering the top-3 how-to prompts",
      rationale:
        "Gemini answers procedural questions with numbered steps. A guide with clean numbering + short bullets is the ideal shape.",
      impact: { mentions_per_month: 5, visibility_delta: 8 },
      priority: 75,
    },
    {
      kind: "entity-page",
      title: "Create a canonical entity page for your brand with a knowledge-panel-ready summary",
      rationale:
        "Gemini leans on knowledge-graph-style facts. A single canonical page with a clear \"X is a Y that does Z\" opener helps entity resolution.",
      impact: { mentions_per_month: 3, visibility_delta: 6 },
      priority: 62,
    },
  ],
  google_ai_overview: [
    {
      kind: "featured-snippet-page",
      title: "Optimize the top gap prompts as featured-snippet targets",
      rationale:
        "Google AI Overviews largely lift from featured snippets. Structure the answer in the first 40-60 words with a definition + short list.",
      impact: { mentions_per_month: 9, visibility_delta: 15 },
      priority: 90,
    },
    {
      kind: "trusted-source-citation",
      title: "Earn a citation on a top-authority third-party domain",
      rationale:
        "AI Overview weights trusted-source citations. One authoritative third-party mention often outperforms your own page.",
      impact: { mentions_per_month: 6, visibility_delta: 12 },
      priority: 80,
    },
    {
      kind: "long-tail-cluster",
      title: "Publish a cluster of long-tail question pages for the underserved prompts",
      rationale:
        "AI Overviews often appear for long-tail queries. Covering 5-10 adjacent long-tails converts to consistent surface area.",
      impact: { mentions_per_month: 4, visibility_delta: 7 },
      priority: 68,
    },
  ],
  grok: [
    {
      kind: "topical-breadth",
      title: "Broaden topical coverage across adjacent question clusters",
      rationale:
        "Grok favors breadth signals from live web search — publishing on adjacent topics raises the odds you're pulled into the answer.",
      impact: { mentions_per_month: 5, visibility_delta: 9 },
      priority: 74,
    },
    {
      kind: "recency-page",
      title: "Publish a dated \"latest update\" page for the top gap prompt",
      rationale:
        "Grok's web-search weighting rewards recency. A dated page with an explicit last-updated line is a cheap durable lift.",
      impact: { mentions_per_month: 4, visibility_delta: 6 },
      priority: 66,
    },
    {
      kind: "social-signal",
      title: "Land 3 organic social posts referencing your top pages",
      rationale:
        "Grok pulls from social conversations. A handful of organic mentions with page links tends to feed the model.",
      impact: { mentions_per_month: 3, visibility_delta: 5 },
      priority: 58,
    },
  ],
  copilot: [
    {
      kind: "enterprise-credentials",
      title: "Add SOC 2 / ISO / SLA badges + a trust page linkable from every product page",
      rationale:
        "Copilot is deployed inside Microsoft 365 — enterprise credential signals disproportionately raise your surface area.",
      impact: { mentions_per_month: 5, visibility_delta: 9 },
      priority: 76,
    },
    {
      kind: "case-study-page",
      title: "Publish 2 named enterprise case studies with quotable metrics",
      rationale:
        "Copilot leans on named-customer proof. A case study with concrete outcome numbers is quotable in enterprise answers.",
      impact: { mentions_per_month: 3, visibility_delta: 6 },
      priority: 68,
    },
    {
      kind: "docs-quality",
      title: "Restructure your top docs pages with per-section anchor headings",
      rationale:
        "Copilot answers procedural questions from documentation. Well-anchored headings improve extraction accuracy.",
      impact: { mentions_per_month: 3, visibility_delta: 5 },
      priority: 60,
    },
  ],
};

// Fallback recipe for unknown engines — engine-agnostic best practice.
const DEFAULT_MOVES: EngineOptimizationMove[] = [
  {
    kind: "answer-block-refresh",
    title: "Refresh the top-3 answer blocks for your priority prompts",
    rationale:
      "Answer blocks with clear one-sentence openers are portable across engines — a low-risk lift.",
    impact: { mentions_per_month: 4, visibility_delta: 6 },
    priority: 60,
  },
  {
    kind: "citation-earning",
    title: "Earn a trusted-source citation for the top gap prompt",
    rationale:
      "Citations move the needle on every citing engine; on non-citing ones they still improve retrieval.",
    impact: { mentions_per_month: 3, visibility_delta: 5 },
    priority: 55,
  },
];

export function generateEngineStrategy(engineName: string): EngineOptimizationMove[] {
  return RECIPES[engineName] ?? DEFAULT_MOVES;
}
