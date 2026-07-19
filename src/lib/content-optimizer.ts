// ============================================================
// Content Optimizer — rewrites existing brand content to be MORE
// citable by AI answer engines (ChatGPT / Perplexity / Gemini).
//
// This is a DRAFT generator. It deliberately inserts [ADD ...]
// placeholders for facts only the brand owner can supply (real
// examples, real stats, author identity). It never invents those
// specifics. The rank-gain estimate is a SIMULATION proxy, not a
// live AI-engine ranking.
// ============================================================

import * as cheerio from "cheerio";
import { getInternalLLM } from "@/lib/llm";

export type OptimizerResult = {
  source: { url?: string; originalText: string; truncated: boolean };
  rewrittenMarkdown: string;
  scores: {
    before: { geo: number; aeo: number; readability: number; overall: number };
    after: { geo: number; aeo: number; readability: number; overall: number };
  };
  suggestions: { issue: string; fix: string }[];
  rankGainProxy: { level: "low" | "medium" | "high"; note: string };
  notes: string[];
};

const MAX_TEXT = 8000;

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT) return { text, truncated: false };
  return { text: text.slice(0, MAX_TEXT), truncated: true };
}

async function extractFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "AnsarAEO-ContentOptimizer/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL (${res.status} ${res.statusText})`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    // Best-effort: just use the raw text body.
    const raw = await res.text();
    return truncate(raw).text;
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const bodyText = $("body").text() ?? $("html").text() ?? "";
  const cleaned = bodyText.replace(/\s+/g, " ").trim();
  return cleanForRead(cleaned);
}

function cleanForRead(text: string): string {
  return truncate(text).text;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function fallbackResult(
  originalText: string,
  truncated: boolean,
  url: string | undefined
): OptimizerResult {
  return {
    source: { url, originalText, truncated },
    rewrittenMarkdown: originalText,
    scores: {
      before: { geo: 0, aeo: 0, readability: 0, overall: 0 },
      after: { geo: 0, aeo: 0, readability: 0, overall: 0 },
    },
    suggestions: [],
    rankGainProxy: {
      level: "low",
      note: "OPENAI_API_KEY not set — add a key to generate an optimized rewrite and scores.",
    },
    notes: [
      "Generation disabled: set OPENAI_API_KEY to produce the optimized draft and GEO/AEO/Readability scores.",
    ],
  };
}

export async function optimizeContent(params: {
  url?: string;
  text?: string;
  brandName: string;
  industry: string | null;
}): Promise<OptimizerResult> {
  const { url, text, brandName, industry } = params;

  // 1. Resolve source text
  let originalText = "";
  let truncated = false;

  try {
    if (url) {
      const fetched = await extractFromUrl(url);
      originalText = fetched;
    } else if (text && text.trim().length > 0) {
      const t = truncate(text);
      originalText = t.text;
      truncated = t.truncated;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read source";
    // Return a result that surfaces the failure rather than throwing.
    return {
      ...fallbackResult(originalText || (text ?? ""), truncated, url),
      notes: [`Could not read source: ${message}. Check the URL is public and returns HTML.`],
    };
  }

  if (!originalText || originalText.trim().length === 0) {
    return {
      ...fallbackResult("", false, url),
      notes: ["No source content provided. Supply a public URL or paste text to optimize."],
    };
  }

  // 2. Degrade gracefully if no OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    return fallbackResult(originalText, truncated, url);
  }

  // 3. Call OpenAI once
  const systemPrompt = `You are a content optimization assistant for the AnsarAEO platform (Answer Engine Optimization / GEO).
Rewrite the user's existing web content so it is MORE likely to be cited by AI answer engines (ChatGPT, Perplexity, Gemini, Google AI Overviews).

Rules:
- Preserve the brand's voice and facts; do NOT invent facts, stats, examples, or author identity.
- Insert explicit [ADD ...] placeholders wherever a real, owner-only fact is needed (e.g. [ADD REAL EXAMPLE], [ADD ORIGINAL DATA POINT], [ADD AUTHOR NAME/CREDENTIALS]).
- Improve: clarity, question-format headings (e.g. "What is ...?"), BLUF (bottom-line-up-front) openings, E-E-A-T signals, and short quotable passages.
- Output "rewrittenMarkdown" as Markdown, roughly 400-700 words.
- Score BOTH the ORIGINAL (before) and the REWRITTEN (after) content on three axes, each 0-100:
  - geo: Geo/Answer-Engine-Optimization quality (citable structure, BLUF, quotability, question headings)
  - aeo: Answer-Engine-Optimization clarity (does it directly answer likely questions?)
  - readability: plain-language readability
- Provide concrete "suggestions" as an array of { issue, fix } describing what to change and how.
Respond ONLY with a JSON object.`;

  const userPrompt = `Brand: ${brandName}
Industry: ${industry ?? "unknown"}
Source: ${url ? `URL ${url}` : "pasted text"}

ORIGINAL CONTENT:
"""
${originalText}
"""

Return JSON: { "before": { "geo": number, "aeo": number, "readability": number }, "after": { "geo": number, "aeo": number, "readability": number }, "reasoning": string, "suggestions": [ { "issue": string, "fix": string } ], "rewrittenMarkdown": string }`;

  try {
    const content = await getInternalLLM().generate({
      system: systemPrompt,
      prompt: userPrompt,
      json: true,
    });

    if (!content) {
      return {
        ...fallbackResult(originalText, truncated, url),
        notes: ["OpenAI returned an empty response."],
      };
    }

    const parsed = JSON.parse(content) as {
      before?: { geo?: number; aeo?: number; readability?: number };
      after?: { geo?: number; aeo?: number; readability?: number };
      suggestions?: { issue: string; fix: string }[];
      rewrittenMarkdown?: string;
    };

    const before = {
      geo: clampScore(parsed.before?.geo ?? 0),
      aeo: clampScore(parsed.before?.aeo ?? 0),
      readability: clampScore(parsed.before?.readability ?? 0),
      overall: 0,
    };
    const after = {
      geo: clampScore(parsed.after?.geo ?? 0),
      aeo: clampScore(parsed.after?.aeo ?? 0),
      readability: clampScore(parsed.after?.readability ?? 0),
      overall: 0,
    };
    before.overall = mean([before.geo, before.aeo, before.readability]);
    after.overall = mean([after.geo, after.aeo, after.readability]);

    const delta = after.overall - before.overall;
    const level: "low" | "medium" | "high" =
      delta >= 20 ? "high" : delta >= 8 ? "medium" : "low";

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s) => s && typeof s.issue === "string" && typeof s.fix === "string")
          .map((s) => ({ issue: s.issue, fix: s.fix }))
      : [];

    const rewrittenMarkdown =
      typeof parsed.rewrittenMarkdown === "string" && parsed.rewrittenMarkdown.trim().length > 0
        ? parsed.rewrittenMarkdown
        : originalText;

    return {
      source: { url, originalText, truncated },
      rewrittenMarkdown,
      scores: { before, after },
      suggestions,
      rankGainProxy: {
        level,
        note: "Proxy estimate from score delta — NOT a real AI-engine ranking.",
      },
      notes: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI call failed";
    return {
      ...fallbackResult(originalText, truncated, url),
      notes: [`Optimization failed: ${message}`],
    };
  }
}
