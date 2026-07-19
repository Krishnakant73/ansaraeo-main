// ============================================================
// GEO Content Linter (Batch 28 harvest: IJONIS/geo-lint, 97 rules)
//
// A DETERMINISTIC, rule-based linter for a single piece of content —
// a page URL or pasted markdown/text. It checks concrete GEO/AEO
// signals (BLUF, question-format headings, answer density, sentence
// length, scannable lists, structured data, entity clarity, ...) and
// emits per-rule pass/warn/fail verdicts, each with a concrete fix.
//
// Deterministic-first by design (honesty): every verdict comes from a
// measurable text/HTML property, NOT an LLM's opinion — so results are
// reproducible and never hallucinated. No API key required, no DB
// writes. HTML-structure rules only run when a URL is fetched (real
// HTML); pasted plain text runs the text-level rules only.
// ============================================================

import * as cheerio from "cheerio";

export type LintStatus = "pass" | "warning" | "fail";

export type LintIssue = {
  rule: string;
  status: LintStatus;
  detail: string;
  fix: string;
};

export type GeoLintResult = {
  source: { url?: string; mode: "url" | "text"; truncated: boolean };
  score: number; // mean of rule statuses (pass=100, warn=55, fail=0)
  wordCount: number;
  issues: LintIssue[];
  notes: string[];
};

const MAX_TEXT = 20000;
const STATUS_VALUE: Record<LintStatus, number> = { pass: 100, warning: 55, fail: 0 };
const QUESTION_STARTERS = /^(what|how|why|when|where|who|which|is|are|can|does|do|should|will)\b/i;

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT) return { text, truncated: false };
  return { text: text.slice(0, MAX_TEXT), truncated: true };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "AnsarAEO-GeoLinter/1.0", Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status} ${res.statusText})`);
  return res.text();
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function runGeoLint(params: { url?: string; text?: string }): Promise<GeoLintResult> {
  const notes: string[] = [];
  const issues: LintIssue[] = [];

  let mode: "url" | "text" = "text";
  let sourceUrl: string | undefined;
  let $: cheerio.CheerioAPI | null = null;
  let plainText = "";
  let truncated = false;

  if (params.url) {
    mode = "url";
    sourceUrl = params.url;
    const html = await fetchHtml(params.url);
    $ = cheerio.load(html);
    $("script, style, noscript, svg, iframe").remove();
    const t = truncate(($("body").text() || "").replace(/\s+/g, " ").trim());
    plainText = t.text;
    truncated = t.truncated;
  } else if (params.text) {
    const t = truncate(params.text);
    plainText = t.text;
    truncated = t.truncated;
  } else {
    return {
      source: { mode, truncated: false },
      score: 0,
      wordCount: 0,
      issues: [],
      notes: ["Provide a page URL or paste content to lint."],
    };
  }

  const words = plainText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = splitSentences(plainText);

  const add = (rule: string, status: LintStatus, detail: string, fix: string) =>
    issues.push({ rule, status, detail, fix });

  // ---------- Text-level rules (always run) ----------

  // 1. Content depth
  if (wordCount >= 600) add("Content depth", "pass", `${wordCount} words — enough for AI engines to extract passages.`, "");
  else if (wordCount >= 300)
    add("Content depth", "warning", `${wordCount} words — a bit thin for topical coverage.`, "Aim for 600+ words with specific, evidence-backed detail.");
  else add("Content depth", "fail", `${wordCount} words — too thin to be cited confidently.`, "Expand to at least 300–600 words of substantive, specific content.");

  // 2. BLUF — direct answer up front
  const firstSentence = sentences[0] ?? "";
  const firstLen = firstSentence.split(/\s+/).filter(Boolean).length;
  if (firstSentence && !firstSentence.trim().endsWith("?") && firstLen > 0 && firstLen <= 30)
    add("BLUF (answer up front)", "pass", `Opens with a ${firstLen}-word declarative sentence.`, "");
  else if (firstSentence.trim().endsWith("?"))
    add("BLUF (answer up front)", "warning", "Opens with a question, not an answer.", "Lead with the direct answer in the first sentence; ask the question in a heading instead.");
  else
    add("BLUF (answer up front)", "warning", firstLen > 30 ? `First sentence is ${firstLen} words — too long to be a clean lead answer.` : "No clear lead sentence.", "Start with a 1–2 sentence Bottom-Line-Up-Front answer AI engines can quote.");

  // 3. Average sentence length (readability)
  const avgLen = sentences.length ? Math.round(words.length / sentences.length) : 0;
  if (avgLen > 0 && avgLen <= 22) add("Sentence readability", "pass", `Average sentence ~${avgLen} words.`, "");
  else if (avgLen <= 30) add("Sentence readability", "warning", `Average sentence ~${avgLen} words — a little dense.`, "Break long sentences up; aim for ~20 words average.");
  else add("Sentence readability", "fail", `Average sentence ~${avgLen} words — hard for engines to extract clean passages.`, "Shorten sentences to ~20 words on average.");

  // 4. Answer/evidence density — concrete numbers present
  const numberMatches = (plainText.match(/\b\d[\d,.]*(%|\b)/g) ?? []).length;
  if (numberMatches >= 3) add("Evidence density", "pass", `${numberMatches} concrete figures/data points detected.`, "");
  else if (numberMatches >= 1) add("Evidence density", "warning", `Only ${numberMatches} concrete figure(s).`, "Add specific numbers, dates, or stats — engines prefer quotable, evidenced claims.");
  else add("Evidence density", "fail", "No concrete numbers or data points found.", "Add specific figures, dates, prices, or measured results to make claims quotable.");

  // 5. Scannable lists
  const hasMarkdownList = /(^|\n)\s*([-*+]|\d+\.)\s+/.test(plainText);
  const hasHtmlList = $ ? $("ul li, ol li").length > 0 : false;
  if (hasMarkdownList || hasHtmlList) add("Scannable lists", "pass", "Contains at least one list.", "");
  else add("Scannable lists", "warning", "No lists detected.", "Add bullet or numbered lists — AI engines lift list items into answers.");

  // 6. Question-format signal (heading or in text)
  const headingTexts: string[] = $
    ? $("h1, h2, h3, h4").map((_, el) => $!(el).text().trim()).get()
    : plainText.split(/\n+/).filter((l) => /^#{1,4}\s/.test(l)).map((l) => l.replace(/^#{1,4}\s/, "").trim());
  const hasQuestionHeading = headingTexts.some((h) => h.endsWith("?") || QUESTION_STARTERS.test(h));
  if (hasQuestionHeading) add("Question-format headings", "pass", "At least one heading is phrased as a question.", "");
  else add("Question-format headings", "warning", "No question-style headings found.", "Phrase key headings as the questions users ask AI (e.g. 'How does X work?').");

  // ---------- HTML-structure rules (URL mode only) ----------
  if ($) {
    // 7. Single H1
    const h1Count = $("h1").length;
    if (h1Count === 1) add("Single H1", "pass", "Exactly one H1.", "");
    else if (h1Count === 0) add("Single H1", "fail", "No H1 found.", "Add a single, descriptive H1.");
    else add("Single H1", "warning", `${h1Count} H1s found.`, "Use exactly one H1 per page.");

    // 8. Heading structure
    const subHeads = $("h2, h3").length;
    if (subHeads >= 2) add("Heading structure", "pass", `${subHeads} H2/H3 subheadings.`, "");
    else add("Heading structure", "warning", `Only ${subHeads} subheading(s).`, "Break content into clearly-titled H2/H3 sections engines can target.");

    // 9. Title tag
    const title = ($("title").first().text() || "").trim();
    if (title.length >= 15 && title.length <= 65) add("Title tag", "pass", `Title is ${title.length} chars.`, "");
    else if (!title) add("Title tag", "fail", "No <title> tag.", "Add a descriptive 15–65 character title.");
    else add("Title tag", "warning", `Title is ${title.length} chars.`, "Keep the title between 15 and 65 characters.");

    // 10. Meta description
    const metaDesc = ($('meta[name="description"]').attr("content") || "").trim();
    if (metaDesc.length >= 50 && metaDesc.length <= 165) add("Meta description", "pass", `Meta description is ${metaDesc.length} chars.`, "");
    else if (!metaDesc) add("Meta description", "fail", "No meta description.", "Add a 50–160 character meta description summarising the answer.");
    else add("Meta description", "warning", `Meta description is ${metaDesc.length} chars.`, "Keep the meta description between 50 and 160 characters.");

    // 11. Structured data
    const jsonLd = $('script[type="application/ld+json"]').length;
    if (jsonLd > 0) add("Structured data (JSON-LD)", "pass", `${jsonLd} JSON-LD block(s) present.`, "");
    else add("Structured data (JSON-LD)", "fail", "No JSON-LD structured data.", "Add schema.org JSON-LD (Article/FAQPage/HowTo/Product) matching the visible content.");
  } else {
    notes.push("Structure rules (H1, title, meta, JSON-LD) are skipped in pasted-text mode — lint a live URL to include them.");
  }

  const score = issues.length
    ? Math.round(issues.reduce((acc, i) => acc + STATUS_VALUE[i.status], 0) / issues.length)
    : 0;

  return {
    source: { url: sourceUrl, mode, truncated },
    score,
    wordCount,
    issues,
    notes,
  };
}
