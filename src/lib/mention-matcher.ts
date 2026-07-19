// ============================================================
// FOUND MISSING via direct review of GetCito's actual source
// (src/lib/competitor-matching.ts): they detect brand/competitor
// mentions using DETERMINISTIC string/fuzzy matching against the raw
// response text (via the `fuzzysort` library), separate from any LLM
// call. Our original approach only ever asked the SAME LLM that
// generated the response to also self-report whether it mentioned each
// brand — which has a real reliability risk: an LLM's self-report about
// its own output can be wrong (hallucinated "yes" or missed "no"),
// especially for longer responses or subtle phrasing.
//
// This adds a deterministic verification pass. It doesn't replace the
// LLM classification (which is still needed for sentiment/position,
// genuinely semantic judgments a string match can't make) — it
// cross-checks the LLM's "brand_mentioned: true/false" against whether
// the name (or a close variant) is actually, literally present in the
// text, and flags disagreement for visibility rather than silently
// trusting either signal blindly.
// ============================================================

function normalize(str: string): string {
  return str.toLowerCase().replace(/^www\./, "").trim();
}

// Simple fuzzy check: does the text contain the name, or a version of it
// with minor character differences (typos, spacing)? Deliberately not
// pulling in a fuzzy-matching library for this — a lightweight Levenshtein
// distance check on a sliding window covers the realistic case (an LLM
// response rarely misspells a brand name by more than 1-2 characters)
// without adding a new dependency.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function deterministicMentionCheck(text: string, name: string): boolean {
  const normalizedText = normalize(text);
  const normalizedName = normalize(name);

  // Exact substring match — the common case
  if (normalizedText.includes(normalizedName)) return true;

  // Fuzzy fallback: slide a window of the name's length across the text,
  // allow small edit distance (handles minor LLM misspellings)
  const words = normalizedText.split(/\s+/);
  const nameWordCount = normalizedName.split(/\s+/).length;
  const maxDistance = Math.max(1, Math.floor(normalizedName.length * 0.15)); // allow ~15% char difference

  for (let i = 0; i <= words.length - nameWordCount; i++) {
    const window = words.slice(i, i + nameWordCount).join(" ");
    if (levenshtein(window, normalizedName) <= maxDistance) return true;
  }

  return false;
}

// Cross-checks the LLM's self-reported mention against the deterministic
// check. Returns the final verdict plus whether the two signals agreed —
// disagreement is logged, not silently resolved, so you can see how often
// this actually happens in practice and tune trust accordingly.
export function reconcileMentionSignal(
  llmSaidMentioned: boolean,
  text: string,
  name: string
): { finalVerdict: boolean; agreed: boolean; deterministicResult: boolean } {
  const deterministicResult = deterministicMentionCheck(text, name);
  const agreed = llmSaidMentioned === deterministicResult;

  // When they disagree, trust the deterministic check for the literal
  // "was the name present" question — it's the more falsifiable signal.
  // The LLM classification remains authoritative for sentiment/position,
  // which genuinely require semantic judgment a string match can't make.
  return { finalVerdict: agreed ? llmSaidMentioned : deterministicResult, agreed, deterministicResult };
}
