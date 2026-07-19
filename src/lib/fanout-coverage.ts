// ============================================================
// Query Fan-Out Coverage (Batch 28 harvest: aiso-copilot +
// ai-visibility-monitor)
//
// When an AI answer engine (ChatGPT / Perplexity / Gemini AI Mode)
// gets a question, it internally "fans out" into a set of related
// sub-questions, retrieves passages for each, and composes an answer.
// A page wins that selection only if it can actually ANSWER those
// sub-questions with evidence.
//
// Given a topic (or a page URL / pasted text), this:
//   1. generates the sub-questions an AI would fan out into, then
//   2. checks — from the supplied content — which sub-questions are
//      answered, partially answered, or missing, WITH the evidence
//      snippet used to decide.
//   3. reports a coverage % (answered ÷ total).
//
// Generation/analysis only: NO DB writes. Degrades gracefully with a
// note (never throws) when OPENAI_API_KEY is absent or a fetch fails.
//
// HONESTY: coverage is judged against the content actually provided.
// When no content is given (topic-only mode) it returns the fan-out
// question set with every item marked "unknown" — it does NOT pretend
// to know whether an unseen page answers them.
// ============================================================

import * as cheerio from "cheerio";

export type CoverageStatus = "answered" | "partial" | "missing" | "unknown";

export type FanoutQuestion = {
  question: string;
  status: CoverageStatus;
  evidence: string; // snippet from the content, or "" when none
  fix: string; // what to add to cover it
};

export type FanoutCoverageResult = {
  topic: string;
  source: { url?: string; hasContent: boolean; truncated: boolean };
  coveragePercent: number; // answered ÷ total (partial counts as half)
  questions: FanoutQuestion[];
  notes: string[];
};

const MAX_TEXT = 8000;
const VALID: CoverageStatus[] = ["answered", "partial", "missing", "unknown"];

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT) return { text, truncated: false };
  return { text: text.slice(0, MAX_TEXT), truncated: true };
}

async function extractFromUrl(url: string): Promise<{ text: string; truncated: boolean }> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "AnsarAEO-FanoutCoverage/1.0", Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status} ${res.statusText})`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const bodyText = ($("body").text() || $("html").text() || "").replace(/\s+/g, " ").trim();
  return truncate(bodyText);
}

export async function runFanoutCoverage(params: {
  topic: string;
  url?: string;
  text?: string;
}): Promise<FanoutCoverageResult> {
  const topic = params.topic.trim();
  const notes: string[] = [];
  const apiKey = process.env.OPENAI_API_KEY;

  // Resolve content (url takes priority, then pasted text).
  let content = "";
  let truncated = false;
  let sourceUrl: string | undefined;
  if (params.url) {
    sourceUrl = params.url;
    try {
      const extracted = await extractFromUrl(params.url);
      content = extracted.text;
      truncated = extracted.truncated;
    } catch (err) {
      notes.push(`Could not fetch the URL: ${(err as Error).message}. Analysing topic only.`);
    }
  } else if (params.text) {
    const t = truncate(params.text.trim());
    content = t.text;
    truncated = t.truncated;
  }
  const hasContent = content.length > 0;

  if (!apiKey) {
    return {
      topic,
      source: { url: sourceUrl, hasContent, truncated },
      coveragePercent: 0,
      questions: [],
      notes: ["OPENAI_API_KEY not set — add a key to generate the fan-out question set.", ...notes],
    };
  }

  const systemPrompt = `You are an AI Search / Answer Engine Optimization analyst. When an AI answer engine (ChatGPT, Perplexity, Gemini AI Mode) receives a query it FANS OUT into related sub-questions, retrieves passages for each, and composes an answer. A page is only cited if it can answer those sub-questions with evidence.

Topic / query: "${topic}"

Step 1: List 8–12 realistic sub-questions an AI would fan out into for this topic.

Step 2: ${
    hasContent
      ? `Given the CONTENT below, judge each sub-question as:
- "answered": the content directly and clearly answers it (quote the evidence snippet verbatim, <=160 chars),
- "partial": the content touches it but lacks specifics/evidence (quote what's there),
- "missing": the content does not answer it (evidence "").
Only mark "answered" when there is a real supporting snippet in the content — do not invent evidence.

CONTENT:
"""
${content}
"""`
      : `No page content was supplied, so mark every sub-question "unknown" with evidence "" (you cannot judge an unseen page).`
  }

For each sub-question also give a short "fix": what to add to the page to fully cover it.

Return ONLY valid JSON:
{
  "questions": [
    { "question": "...", "status": "answered|partial|missing|unknown", "evidence": "...", "fix": "..." }
  ]
}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      return {
        topic,
        source: { url: sourceUrl, hasContent, truncated },
        coveragePercent: 0,
        questions: [],
        notes: [`OpenAI request failed (${res.status}). Try again later.`, ...notes],
      };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
      questions?: unknown;
    };
    const raw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions: FanoutQuestion[] = raw
      .map((q): FanoutQuestion | null => {
        if (!q || typeof q !== "object") return null;
        const r = q as Record<string, unknown>;
        const question = typeof r.question === "string" ? r.question.trim() : "";
        if (!question) return null;
        let status = VALID.includes(r.status as CoverageStatus) ? (r.status as CoverageStatus) : "unknown";
        if (!hasContent) status = "unknown";
        return {
          question,
          status,
          evidence: typeof r.evidence === "string" ? r.evidence.trim() : "",
          fix: typeof r.fix === "string" ? r.fix.trim() : "",
        };
      })
      .filter((q): q is FanoutQuestion => q !== null);

    // Coverage %: answered = 1, partial = 0.5, else 0. "unknown" excluded
    // from the denominator so topic-only mode reports 0/0 → 0 honestly.
    const scorable = questions.filter((q) => q.status !== "unknown");
    const score = scorable.reduce((acc, q) => acc + (q.status === "answered" ? 1 : q.status === "partial" ? 0.5 : 0), 0);
    const coveragePercent = scorable.length > 0 ? Math.round((score / scorable.length) * 100) : 0;

    if (!hasContent) {
      notes.push("Topic-only mode: supply a page URL or paste content to measure how much of the fan-out it covers.");
    }

    return {
      topic,
      source: { url: sourceUrl, hasContent, truncated },
      coveragePercent,
      questions,
      notes,
    };
  } catch {
    return {
      topic,
      source: { url: sourceUrl, hasContent, truncated },
      coveragePercent: 0,
      questions: [],
      notes: ["Could not parse the fan-out analysis. Try again later.", ...notes],
    };
  }
}
