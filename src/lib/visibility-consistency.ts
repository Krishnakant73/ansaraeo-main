// ============================================================
// Mention Consistency KPI
// ------------------------------------------------------------
// Re-runs ONE prompt N times (default 3, clamped 2..5) on a
// chosen AI engine and computes a MENTION-STABILITY score: how
// RELIABLY the brand is cited across repeated identical prompts.
//
// This is a STABILITY proxy, NOT a single ranking. It is fully
// stateless — it performs no DB writes. Brand mention is a
// DETERMINISTIC case-insensitive substring/fuzzy check of the
// brand name in the answer text (same honesty rule as
// src/lib/mention-matcher.ts). It does NOT use an LLM
// self-report for the mention boolean.
// ============================================================

import { deterministicMentionCheck } from "@/lib/mention-matcher";

export type ConsistencyRun = { run: number; mentioned: boolean; snippet: string };

export type ConsistencyResult = {
  promptText: string;
  engine: string;
  runs: number;
  mentionedRuns: number;
  mentionRate: number;
  consistencyScore: number;
  perRun: ConsistencyRun[];
  notes: string[];
};

// ──────────────────────────────────────────────────────────
// ⚠️  ANSWER ENGINES = MEASUREMENT TARGETS, NOT THE INTERNAL LLM.
// callEngine below measures whether a CUSTOMER-facing engine mentions
// the brand. It is NOT an InternalLLMProvider (src/lib/llm/*) and
// must never share code with that module. See src/lib/llm/README.md.
// ──────────────────────────────────────────────────────────
type EngineResult = { content: string };

// Minimal local engine caller — returns the answer text ONLY.
// Mirrors the exact request shapes in src/lib/visibility-engine.ts
// for each engine. Does NOT call runVisibilityCheck (that writes
// DB rows). If the engine key is missing it throws a clear,
// human-readable Error so the caller can emit a note.
export async function callEngine(engine: string, promptText: string): Promise<string> {
  switch (engine) {
    case "chatgpt": {
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: promptText }] }),
      });
      if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return data.choices[0].message.content;
    }
    case "perplexity": {
      if (!process.env.PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY not set");
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
        body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: promptText }] }),
      });
      if (!res.ok) throw new Error(`Perplexity error: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return data.choices[0].message.content;
    }
    case "gemini": {
      if (!process.env.GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not set");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
        }
      );
      if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
      return data.candidates[0].content.parts[0].text;
    }
    case "grok": {
      if (!process.env.GROK_API_KEY) throw new Error("GROK_API_KEY not set");
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROK_API_KEY}` },
        body: JSON.stringify({
          model: "grok-2-latest",
          messages: [{ role: "user", content: promptText }],
          search_parameters: { mode: "on" },
        }),
      });
      if (!res.ok) throw new Error(`Grok error: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return data.choices[0].message.content;
    }
    case "copilot": {
      const url = process.env.COPILOT_API_URL;
      const key = process.env.COPILOT_API_KEY;
      if (!url || !key) throw new Error("COPILOT_API_URL/COPILOT_API_KEY not set");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.COPILOT_MODEL ?? "gpt-4o-mini",
          messages: [{ role: "user", content: promptText }],
        }),
      });
      if (!res.ok) throw new Error(`Copilot proxy error: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return data.choices[0].message.content;
    }
    default:
      throw new Error(`No caller implemented for engine "${engine}"`);
  }
}

// Build a ~len-char snippet of the answer, centered on the brand
// mention when found, else the opening of the text.
function buildSnippet(text: string, brandName: string, len = 160): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const idx = lower.indexOf(brandName.toLowerCase());
  if (idx === -1) return trimmed.slice(0, len);
  const start = Math.max(0, Math.floor(idx - len / 2));
  const end = Math.min(trimmed.length, start + len);
  return trimmed.slice(start, end);
}

export async function runConsistencyCheck(params: {
  promptText: string;
  engine: string;
  brandName: string;
  runs?: number;
}): Promise<ConsistencyResult> {
  const { promptText, engine, brandName } = params;
  const runs = Math.min(5, Math.max(2, Math.floor(params.runs ?? 3)));

  const baseNotes = [
    "Consistency measures how reliably the brand is mentioned across repeated identical prompts — a stability proxy, not a single ranking.",
  ];

  // google_ai_overview is a SERP scrape, not a chat completion — it is
  // not suited to repeated-prompt sampling. Be honest about that.
  if (engine === "google_ai_overview") {
    return {
      promptText,
      engine,
      runs: 0,
      mentionedRuns: 0,
      mentionRate: 0,
      consistencyScore: 0,
      perRun: [],
      notes: [
        "google_ai_overview is a SERP scrape, not suited to repeated-prompt sampling. Choose chatgpt/perplexity/gemini/grok/copilot.",
      ],
    };
  }

  // Pre-check required engine key so a missing key yields a clean note
  // rather than several failed per-run attempts.
  const missingKeyMessage: Record<string, string> = {
    chatgpt: "OPENAI_API_KEY not set — add it to sample ChatGPT.",
    perplexity: "PERPLEXITY_API_KEY not set — add it to sample Perplexity.",
    gemini: "GOOGLE_AI_API_KEY not set — add it to sample Gemini.",
    grok: "GROK_API_KEY not set — add it to sample Grok.",
    copilot: "COPILOT_API_URL/COPILOT_API_KEY not set — add them to sample Copilot (a proxy).",
  };
  const missingKey = missingKeyMessage[engine];
  if (missingKey) {
    return {
      promptText,
      engine,
      runs: 0,
      mentionedRuns: 0,
      mentionRate: 0,
      consistencyScore: 0,
      perRun: [],
      notes: [missingKey, ...baseNotes],
    };
  }

  const perRun: ConsistencyRun[] = [];
  let mentionedRuns = 0;

  for (let i = 1; i <= runs; i++) {
    let content = "";
    try {
      content = await callEngine(engine, promptText);
    } catch (err) {
      // A runtime/network error for this run — record it as not mentioned
      // with the error surfaced in the snippet (honest, no fabrication).
      perRun.push({
        run: i,
        mentioned: false,
        snippet: `Error during run ${i}: ${(err as Error).message}`,
      });
      continue;
    }

    const mentioned = deterministicMentionCheck(content, brandName);
    if (mentioned) mentionedRuns += 1;

    perRun.push({
      run: i,
      mentioned,
      snippet: buildSnippet(content, brandName),
    });
  }

  const mentionRate = runs > 0 ? mentionedRuns / runs : 0;
  const consistencyScore = Math.round(mentionRate * 100);

  return {
    promptText,
    engine,
    runs,
    mentionedRuns,
    mentionRate,
    consistencyScore,
    perRun,
    notes: baseNotes,
  };
}
