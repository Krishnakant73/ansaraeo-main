import EvidenceChip from "@/workspace/primitives/EvidenceChip";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { EnginePersonality } from "@/lib/engine-personality";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// AiPersonalityProfile — six horizontal-bar cards, each labeled
// with the axis + a one-liner interpretation. Server component;
// reads engine.personality (cached in engine_personalities, live-
// computed fallback in engine-workspace.ts).
//
// Each axis maps to a plain-English interpretation the reader can
// act on: "Verbose: expects long-form answers." Values scale 0..100.
// ============================================================

type Interpretation = {
  key: keyof EnginePersonality;
  label: string;
  lowBand: string;   // description when score < 34
  midBand: string;   // 34..66
  highBand: string;  // >= 67
  guidance: (score: number) => string;
};

const AXES: Interpretation[] = [
  {
    key: "verbosity",
    label: "Verbosity",
    lowBand: "Answers are terse — short sentences, few paragraphs.",
    midBand: "Answers are typical length.",
    highBand: "Answers are long-form — the engine expects detail and prose.",
    guidance: (s) =>
      s >= 67
        ? "Feed it depth: multi-paragraph answers with concrete examples earn a mention."
        : s < 34
          ? "Feed it brevity: put the answer in the first 50 words of the page."
          : "Both formats work — bias toward the top-of-page one-liner.",
  },
  {
    key: "hedging",
    label: "Hedging",
    lowBand: "The engine is confident and prescriptive.",
    midBand: "The engine mixes hedges with directives.",
    highBand: "The engine hedges heavily (\"may\", \"could\", \"typically\").",
    guidance: (s) =>
      s >= 67
        ? "Prescriptive content stands out: use imperative verbs and definitive claims to be quoted."
        : s < 34
          ? "The model quotes prescriptive text verbatim — write in the imperative."
          : "Lead with a directive sentence, back it with a nuanced follow-up.",
  },
  {
    key: "format_bias",
    label: "Format bias",
    lowBand: "The engine prefers prose over lists.",
    midBand: "Mixed formatting — prose and bullets both appear.",
    highBand: "The engine prefers bullets and numbered lists.",
    guidance: (s) =>
      s >= 67
        ? "Structure your key pages as bulleted answers — the model lifts lists directly."
        : s < 34
          ? "Write flowing paragraphs with an answer-block opener; prose is quoted."
          : "Include a bulleted TL;DR at the top of prose content.",
  },
  {
    key: "freshness_bias",
    label: "Freshness bias",
    lowBand: "The engine cites evergreen or undated sources.",
    midBand: "Mixed — recency helps but is not required.",
    highBand: "The engine cites recent sources (past 12 months).",
    guidance: (s) =>
      s >= 67
        ? "Add explicit last-updated dates to top pages. Fresh pages win here."
        : s < 34
          ? "Evergreen content holds up. Prioritize authoritative pages over dated news."
          : "Refresh top pages quarterly — recency helps but isn't required.",
  },
  {
    key: "citation_density",
    label: "Citation density",
    lowBand: "Almost never surfaces citations.",
    midBand: "Some citations per answer.",
    highBand: "Cites heavily — several sources per answer.",
    guidance: (s) =>
      s >= 67
        ? "Every quotable page needs a stable canonical URL — citations are the currency here."
        : s < 34
          ? "Citations rarely appear. Focus on being IN the answer, not linked to."
          : "Balance — earn citations but write pages that stand on their own.",
  },
  {
    key: "entity_resolution",
    label: "Entity resolution",
    lowBand: "Rarely names specific brands in top positions.",
    midBand: "Mentions brands but with mixed positioning.",
    highBand: "Consistently surfaces named brands high in the answer.",
    guidance: (s) =>
      s >= 67
        ? "Named-brand answers are the norm — a comparison table lifts you into the top ranks."
        : s < 34
          ? "Named-brand answers are rare — focus on category-level presence first."
          : "Mixed — a strong entity page (\"X is a Y that does Z\") helps resolution.",
  },
];

export default function AiPersonalityProfile({ engine }: { engine: Engine }) {
  if (engine.personality.runs_observed === 0) {
    return (
      <EmptyStateCoach
        title="Not enough runs to profile behavior"
        description={`Run a few scans on ${engine.displayName} so we can measure verbosity, hedging, formatting bias, and more.`}
        action={{
          label: "Run visibility scan",
          href: `/dashboard/b/${engine.brand.slug}/visibility`,
        }}
      />
    );
  }

  return (
    <section aria-label={`AI personality profile for ${engine.displayName}`}>
      <div className="flex items-baseline justify-between">
        <p className="section-label">AI Personality Profile</p>
        <EvidenceChip
          parts={[
            `${engine.personality.runs_observed} run${engine.personality.runs_observed === 1 ? "" : "s"}`,
            engine.personality.sample_run_ids.length > 0
              ? `${engine.personality.sample_run_ids.length} sample${engine.personality.sample_run_ids.length === 1 ? "" : "s"}`
              : "no samples",
          ]}
        />
      </div>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {AXES.map((a) => {
          const score = Number(engine.personality[a.key] ?? 0);
          const band = score >= 67 ? "high" : score >= 34 ? "mid" : "low";
          const bandLabel = band === "high" ? a.highBand : band === "mid" ? a.midBand : a.lowBand;
          const tone =
            band === "high"
              ? "text-emerald-700"
              : band === "mid"
                ? "text-ink"
                : "text-rose-600";
          return (
            <li key={a.key as string} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-ink">{a.label}</p>
                <span className={`font-mono text-xs font-semibold ${tone}`}>{Math.round(score)}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-surface" aria-hidden>
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, Math.max(2, score))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">{bandLabel}</p>
              <p className="mt-1 text-[11px] text-ink/80">{a.guidance(score)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
