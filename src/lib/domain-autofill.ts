// ============================================================
// FOUND MISSING via direct review of GetCito's actual source code
// (src/lib/get-company-info.ts): their onboarding only asks for a
// domain — everything else (company name, description, category,
// competitors) is auto-filled by an LLM that already has general
// knowledge of many companies. Our onboarding (Part 1/5) required
// the user to manually type brand name, category, AND competitor —
// unnecessary friction for any brand the model already knows about.
//
// This brings that UX improvement in, but keeps OUR stricter honesty
// principle (Part 7): every suggested field is EDITABLE and requires
// the user to review/submit, never auto-created blind. GetCito's
// version silently falls back to a low-quality guess on failure with
// no user-facing warning — ours surfaces confidence honestly instead.
// ============================================================

export type AutofillResult = {
  companyName: string;
  shortDescription: string;
  suggestedCategory: string;
  suggestedCompetitors: string[];
  confidence: "high" | "low"; // "low" = model likely doesn't really know this domain
};

export async function autofillFromDomain(domain: string): Promise<AutofillResult> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You identify a company from its domain name using your general knowledge. Respond ONLY as JSON: " +
            '{"companyName": string, "shortDescription": string, "suggestedCategory": string, ' +
            '"suggestedCompetitors": string[], "confidence": "high"|"low"}. ' +
            'Set confidence to "low" if you are not genuinely confident you know this specific company — ' +
            "do not invent plausible-sounding details for a domain you don't actually recognize. " +
            "suggestedCategory should be a short product category, e.g. 'D2C skincare' or 'B2B SaaS'.",
        },
        { role: "user", content: `Domain: ${cleanDomain}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Autofill error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
