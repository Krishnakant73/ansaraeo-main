// ============================================================
// Real Google AI Overview fetching. Google has no public API for AI
// Overview content — it only appears rendered inside actual Google
// Search results — so this uses DataForSEO's SERP API (a third-party
// SERP-scraping service; GetCito's own source uses the same provider),
// requesting `load_async_ai_overview: true` to capture the AI Overview
// box specifically, not just organic results.
//
// This is DIFFERENT from calling Gemini's chatbot API (Gemini is a
// separate Google product from the AI Overview search feature) —
// see migration_009's comment for why this distinction matters.
// ============================================================

export async function fetchGoogleAIOverview(query: string): Promise<{ content: string; hasAIOverview: boolean }> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not configured — see setup notes");
  }

  const authHeader = "Basic " + Buffer.from(`${login}:${password}`).toString("base64");

  const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        keyword: query,
        location_code: 2356, // India — see DataForSEO's location codes reference for other countries
        language_code: "en",
        device: "desktop",
        load_async_ai_overview: true,
      },
    ]),
  });

  if (!res.ok) throw new Error(`DataForSEO error: ${res.status} ${await res.text()}`);
  const data = await res.json();

  const items = data.tasks?.[0]?.result?.[0]?.items ?? [];
  const aiOverviewItem = items.find((item: { type: string }) => item.type === "ai_overview");

  if (!aiOverviewItem) {
    return { content: "", hasAIOverview: false };
  }

  // DataForSEO returns the AI Overview as structured blocks — flatten to
  // plain text for the same classification pipeline every other engine uses.
  const textBlocks = (aiOverviewItem.items ?? [])
    .map((block: { text?: string }) => block.text)
    .filter(Boolean);

  return { content: textBlocks.join("\n\n"), hasAIOverview: true };
}
