// ============================================================
// PDP Generator (Batch 26) — e-commerce Product-Page GEO
// optimization.
//
// Given a product page URL and/or a pasted product JSON, this extracts
// REAL product facts (never inventing reviews or prices), builds a
// schema.org Product JSON-LD plus an AI-citation-optimized Markdown
// description, and records an evidence ledger mapping each field to the
// source it came from.
//
// Honesty rule (same as Content Studio / AI Index): every field that
// only the brand owner can truthfully supply (exact price/currency,
// real review quotes, SKU) is left as an [ADD ...] placeholder.
// ============================================================

export type PdpResult = {
  input: { url?: string; providedJson: boolean };
  productJsonLd: string;
  geoCopy: string;
  evidenceLedger: { field: string; value: string; source: string }[];
  missingFields: string[];
  diagnostics: string[];
  notes: string[];
};

type OpenAiPdp = {
  name?: string;
  description?: string;
  price?: string;
  currency?: string;
  features?: string[];
  reviewsSummary?: string;
  brand?: string;
  evidence?: { field: string; source: string }[];
  missing?: string[];
  diagnostics?: string[];
};

function extractJsonLd(html: string): string {
  const matches = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!matches || matches.length === 0) return "";
  return matches
    .map((m) => m.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, ""))
    .join("\n\n");
}

export async function generatePdp(params: {
  url?: string;
  productJson?: string;
  brandName: string;
}): Promise<PdpResult> {
  const input: { url?: string; providedJson: boolean } = {
    url: params.url,
    providedJson: Boolean(params.productJson),
  };

  const diagnostics: string[] = [];
  const notes: string[] = [];

  // ---- 1. Gather page context (URL fetch) -------------------------
  let pageText = "";
  let existingJsonLd = "";
  if (params.url) {
    try {
      const res = await fetch(params.url, {
        method: "GET",
        headers: { "User-Agent": "AnsarAEO-PDPBot/1.0" },
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      if (!res.ok) {
        diagnostics.push(
          `Fetch of ${params.url} returned ${res.status} ${res.statusText}.`
        );
      } else {
        pageText = await res.text();
        existingJsonLd = extractJsonLd(pageText);
        if (!existingJsonLd) {
          diagnostics.push("No existing JSON-LD <script> found on the page.");
        }
      }
    } catch (e) {
      diagnostics.push(
        `Could not fetch ${params.url}: ${
          e instanceof Error ? e.message : "unknown error"
        }.`
      );
    }
  }

  // ---- 2. Gather context (pasted product JSON) --------------------
  let providedObj: Record<string, unknown> | null = null;
  if (params.productJson) {
    try {
      providedObj = JSON.parse(params.productJson) as Record<string, unknown>;
    } catch {
      diagnostics.push(
        "Provided productJson could not be parsed (invalid JSON) — ignoring it."
      );
    }
  }

  // ---- 3. Degrade gracefully when no OpenAI key -------------------
  if (!process.env.OPENAI_API_KEY) {
    return {
      input,
      productJsonLd: "",
      geoCopy: "",
      evidenceLedger: [],
      missingFields: ["name", "description"],
      diagnostics,
      notes: [
        "OPENAI_API_KEY not set — add a key to generate product schema and copy.",
      ],
    };
  }

  // ---- 4. Build the model context ---------------------------------
  const contextParts: string[] = [];
  if (providedObj) {
    contextParts.push(
      "PROVIDED PRODUCT JSON:\n" + JSON.stringify(providedObj, null, 2)
    );
  }
  if (existingJsonLd) {
    contextParts.push("EXISTING JSON-LD ON PAGE:\n" + existingJsonLd);
  }
  if (pageText) {
    const trimmed =
      pageText.length > 20000 ? pageText.slice(0, 20000) : pageText;
    contextParts.push("PAGE HTML (truncated):\n" + trimmed);
  }

  if (contextParts.length === 0) {
    return {
      input,
      productJsonLd: "",
      geoCopy: "",
      evidenceLedger: [],
      missingFields: ["name", "description"],
      diagnostics: [
        ...diagnostics,
        "No URL or product JSON was supplied — nothing to extract from.",
      ],
      notes,
    };
  }

  // ---- 5. Call OpenAI gpt-4o-mini ONCE (json mode) ----------------
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extract structured product data from a product page or product JSON for an e-commerce brand.

Rules:
- Extract ONLY what is actually present in the provided material. Never invent.
- For each extracted field, record its "source" — one of: "JSON-LD Product", "provided JSON", "h1", "meta description", "og tags", "microdata", "page text".
- The required fields are "name" and "description". If either is missing, add it to "missing".
- Add a "diagnostics" array describing citable-quality issues (e.g. "no FAQ schema", "no review schema", "price not visible", "thin description", "no brand marked").
- Do NOT fabricate reviews or prices. If a price/review is not present, omit it — never guess.

Respond ONLY as JSON with this exact shape:
{
  "name": string,
  "description": string,
  "price": string,
  "currency": string,
  "features": string[],
  "reviewsSummary": string,
  "brand": string,
  "evidence": [{ "field": string, "source": string }],
  "missing": string[],
  "diagnostics": string[]
}`,
        },
        {
          role: "user",
          content: `Brand: ${params.brandName}\n\n${contextParts.join("\n\n")}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`PDP generation error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0].message.content) as OpenAiPdp;

  // ---- 6. Field-contract validation (name + description) ----------
  const missingFields = Array.from(
    new Set([
      ...(parsed.missing ?? []),
      ...(parsed.name ? [] : ["name"]),
      ...(parsed.description ? [] : ["description"]),
    ])
  );

  // ---- 7. Build evidence ledger (field | value | source) ----------
  const valueLookup: Record<string, string> = {
    name: parsed.name ?? "",
    description: parsed.description ?? "",
    price: parsed.price ?? "",
    currency: parsed.currency ?? "",
    brand: parsed.brand ?? "",
    features: (parsed.features ?? []).join(", "),
    reviewsSummary: parsed.reviewsSummary ?? "",
  };

  const evidenceLedger = (parsed.evidence ?? []).map((e) => ({
    field: e.field,
    value: valueLookup[e.field] ?? "",
    source: e.source,
  }));

  // ---- 8. Build schema.org Product JSON-LD ------------------------
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: parsed.name || "[ADD PRODUCT NAME]",
    description: parsed.description || "[ADD PRODUCT DESCRIPTION]",
  };

  if (parsed.brand) {
    product.brand = { "@type": "Brand", name: parsed.brand };
  }

  if (parsed.features && parsed.features.length > 0) {
    product.additionalProperty = parsed.features.map((f, i) => ({
      "@type": "PropertyValue",
      name: `feature-${i + 1}`,
      value: f,
    }));
  }

  product.offers = {
    "@type": "Offer",
    price: parsed.price || "[ADD EXACT PRICE]",
    priceCurrency: parsed.currency || "[ADD CURRENCY]",
    availability: "[ADD AVAILABILITY e.g. https://schema.org/InStock]",
    url: params.url || "[ADD PRODUCT PAGE URL]",
  };

  // Reviews: never fabricated — always a placeholder for real quotes.
  product.review = [
    {
      "@type": "Review",
      reviewBody: "[ADD REAL REVIEW QUOTES]",
      author: { "@type": "Person", name: "[ADD REVIEWER NAME/INITIALS]" },
    },
  ];

  product.sku = "[ADD SKU]";

  const productJsonLd = JSON.stringify(product, null, 2);

  // ---- 9. Build citation-optimized geoCopy (Markdown) -------------
  const geoName = parsed.name || "[ADD PRODUCT NAME]";
  const geoBrand = parsed.brand || params.brandName || "[ADD BRAND]";
  const geoDesc = parsed.description || "[ADD PRODUCT DESCRIPTION]";
  const geoFeatures =
    parsed.features && parsed.features.length > 0
      ? parsed.features.map((f) => `- ${f}`).join("\n")
      : "- [ADD KEY FEATURE 1]\n- [ADD KEY FEATURE 2]";

  const geoCopy = `## ${geoName}

**${geoBrand}** — ${geoDesc}

### What is it?
${geoDesc}

### Key features
${geoFeatures}

### What does it cost?
Priced at **[ADD EXACT PRICE]** ([ADD CURRENCY]). [ADD AVAILABILITY / SHIPPING NOTE]

### What are customers saying?
[ADD REAL REVIEW QUOTES — verbatim, attributed to real reviewers]

### Who is it for?
[ADD TARGET AUDIENCE / USE CASE]

### Where to buy
${params.url || "[ADD PRODUCT PAGE URL]"}
`;

  return {
    input,
    productJsonLd,
    geoCopy,
    evidenceLedger,
    missingFields,
    diagnostics: [...diagnostics, ...(parsed.diagnostics ?? [])],
    notes,
  };
}
