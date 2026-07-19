import { getInternalLLM } from "@/lib/llm";

// ============================================================
// Answer Block Generator (Batch 28 harvest: kxwu222 aeo-snippet-writer)
//
// Generates AEO-optimized "answer blocks" for a single target
// question, in the five formats AI answer engines and featured
// snippets favour:
//   - paragraph  (BLUF — direct answer in 2–3 sentences)
//   - list       (ordered/unordered steps or points)
//   - table      (comparison / spec table, Markdown)
//   - howto      (numbered HowTo steps)
//   - faq        (Q&A pairs suited to FAQPage schema)
//
// Plus a ready-to-paste schema.org JSON-LD stub (FAQPage or HowTo).
//
// Generation-only: NO DB writes. This is a DRAFT — it inserts
// [ADD ...] placeholders for facts only the brand owner can supply
// (real numbers, prices, dates, named authors) and never invents them,
// same honesty rule as Content Studio. Degrades with a note (never
// throws) when OPENAI_API_KEY is absent.
// ============================================================

export type AnswerBlockFormat = "paragraph" | "list" | "table" | "howto" | "faq";

export type AnswerBlock = {
  format: AnswerBlockFormat;
  markdown: string;
};

export type AnswerBlocksResult = {
  question: string;
  blocks: AnswerBlock[];
  schemaJsonLd: string; // "" when none generated
  notes: string[];
};

const FORMATS: AnswerBlockFormat[] = ["paragraph", "list", "table", "howto", "faq"];

export async function generateAnswerBlocks(params: {
  question: string;
  brandName: string;
  industry: string | null;
}): Promise<AnswerBlocksResult> {
  const question = params.question.trim();
  const { brandName, industry } = params;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      question,
      blocks: [],
      schemaJsonLd: "",
      notes: ["OPENAI_API_KEY not set — add a key to generate answer blocks."],
    };
  }

  const systemPrompt = `You are an Answer Engine Optimization (AEO) copywriter. Write answer blocks that AI answer engines (ChatGPT, Perplexity, Gemini AI Mode) and Google featured snippets can quote directly.

Target question: "${question}"
Brand context: "${brandName}"${industry ? ` in the ${industry} industry` : ""} (weave the brand in naturally ONLY where truthful and relevant; do not force it).

Produce the SAME answer in five formats:
1. paragraph — Bottom-Line-Up-Front: answer in the first sentence, 2–3 sentences total.
2. list — a scannable ordered or unordered list of the key points.
3. table — a compact Markdown comparison/spec table with a header row.
4. howto — numbered step-by-step HowTo.
5. faq — 3–4 concise Q&A pairs around the question.

RULES:
- Be accurate and specific, but NEVER invent facts you cannot know (prices, exact stats, dates, review counts, named people). Where such a specific belongs, insert a literal placeholder like [ADD REAL NUMBER] or [ADD SOURCE] so a human fills it in.
- Keep language plain and quotable. No marketing fluff.

Also produce a schema.org JSON-LD stub: use FAQPage built from the faq block (or HowTo if the question is procedural). Include the [ADD ...] placeholders inline where needed.

Return ONLY valid JSON:
{
  "blocks": [
    { "format": "paragraph", "markdown": "..." },
    { "format": "list", "markdown": "..." },
    { "format": "table", "markdown": "..." },
    { "format": "howto", "markdown": "..." },
    { "format": "faq", "markdown": "..." }
  ],
  "schemaJsonLd": "<script type=\\"application/ld+json\\">{ ... }</script>"
}`;

  try {
    const raw = await getInternalLLM().generate({
      system: systemPrompt,
      json: true,
      temperature: 0.6,
    });
    const parsed = JSON.parse(raw ?? "{}") as {
      blocks?: unknown;
      schemaJsonLd?: unknown;
    };
    const blocks: AnswerBlock[] = (Array.isArray(parsed.blocks) ? (parsed.blocks as unknown[]) : [])
      .map((b): AnswerBlock | null => {
        if (!b || typeof b !== "object") return null;
        const r = b as Record<string, unknown>;
        const format = FORMATS.includes(r.format as AnswerBlockFormat) ? (r.format as AnswerBlockFormat) : null;
        const markdown = typeof r.markdown === "string" ? r.markdown.trim() : "";
        if (!format || !markdown) return null;
        return { format, markdown };
      })
      .filter((b): b is AnswerBlock => b !== null);

    return {
      question,
      blocks,
      schemaJsonLd: typeof parsed.schemaJsonLd === "string" ? parsed.schemaJsonLd.trim() : "",
      notes: [],
    };
  } catch {
    return {
      question,
      blocks: [],
      schemaJsonLd: "",
      notes: ["Could not parse the generated answer blocks. Try again later."],
    };
  }
}
