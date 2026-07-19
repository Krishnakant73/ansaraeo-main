// ============================================================
// Content Studio generation logic (Part 4, Tier 1 & Tier 4 / Part 7)
//
// Deliberately generates a DRAFT, never a finished, publish-ready
// article. The system prompt explicitly asks the model to leave
// placeholder markers for things only the brand owner can truthfully
// fill in (real examples, real data, author identity) — this is what
// makes the E-E-A-T checklist in the UI meaningful rather than
// decorative, and it's a direct implementation of the Google-safe
// content strategy from 07-agentic-automation-integrations.md, Section 5.
// ============================================================

export async function generateContentDraft(params: {
  brandName: string;
  promptText: string;
  industry: string | null;
}): Promise<{ title: string; contentMarkdown: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write DRAFT content briefs for a human marketer to review and finish — never a
finished, ready-to-publish article. The brand is "${params.brandName}"${
            params.industry ? `, in the ${params.industry} industry` : ""
          }.

The goal is to close a visibility gap: this brand is currently NOT mentioned when AI
assistants are asked a specific question. Write content genuinely useful for a human
reader that would also give an AI assistant good reason to cite this brand for that
question.

CRITICAL — insert these exact placeholder markers wherever they apply, do not invent
specifics on the brand's behalf:
- [ADD REAL EXAMPLE: ...] where a genuine customer example or use case would help
- [ADD ORIGINAL DATA POINT: ...] where a real statistic specific to this brand would help
- [ADD AUTHOR NAME/CREDENTIALS] near the top

Respond ONLY as JSON: {"title": string, "contentMarkdown": string}. Keep it to roughly
400-600 words, in Markdown with a few headers.`,
        },
        {
          role: "user",
          content: `Write a draft aimed at this exact question a customer might ask an AI assistant: "${params.promptText}"`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Content generation error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as { title: string; contentMarkdown: string };
}
