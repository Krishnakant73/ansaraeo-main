// ============================================================
// Schema-for-AI (Batch 30)
//
// Template library for the schema.org types that matter most for AEO, plus a
// dependency-free JSON-LD validator. Validation is fully deterministic (no LLM,
// no key). Generation only fills brand-known facts (name, domain) and leaves
// owner-only specifics as [ADD ...] placeholders — we never invent prices,
// reviews, addresses, or ratings (honesty principle, same as Content Studio).
// ============================================================

export type SchemaType =
  | "organization"
  | "product"
  | "article"
  | "faqpage"
  | "howto"
  | "localbusiness"
  | "breadcrumblist";

export type SchemaTemplate = {
  type: SchemaType;
  label: string;
  description: string;
  required: string[];
  recommended: string[];
  template: string;
};

export type SchemaValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  type: string | null;
};

const PLACEHOLDER_RE = /\[ADD[^\]]*\]/i;

export const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    type: "organization",
    label: "Organization",
    description: "Establishes the entity. Put it on your homepage so engines resolve what your brand is.",
    required: ["@type", "name", "url"],
    recommended: ["logo", "description", "sameAs"],
    template: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "{{name}}",
        url: "{{url}}",
        logo: "[ADD LOGO URL]",
        description: "[ADD ONE-LINE DESCRIPTION]",
        sameAs: ["[ADD LINKEDIN URL]", "[ADD X/TWITTER URL]", "[ADD WIKIDATA Q-ID URL]"],
      },
      null,
      2
    ),
  },
  {
    type: "product",
    label: "Product",
    description: "Product detail pages — helps engines pull clean price/spec/rating facts into answers.",
    required: ["@type", "name"],
    recommended: ["image", "description", "brand", "offers"],
    template: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "[ADD PRODUCT NAME]",
        image: ["[ADD PRODUCT IMAGE URL]"],
        description: "[ADD PRODUCT DESCRIPTION]",
        brand: { "@type": "Brand", name: "{{name}}" },
        sku: "[ADD SKU]",
        offers: {
          "@type": "Offer",
          price: "[ADD PRICE]",
          priceCurrency: "[ADD CURRENCY e.g. INR]",
          availability: "[ADD http://schema.org/InStock]",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "[ADD 1-5]",
          reviewCount: "[ADD COUNT]",
        },
      },
      null,
      2
    ),
  },
  {
    type: "article",
    label: "Article",
    description: "Blog/news pages — marks authorship, publisher, and freshness (datePublished/Modified).",
    required: ["@type", "headline", "author"],
    recommended: ["datePublished", "dateModified", "publisher"],
    template: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "[ADD HEADLINE]",
        author: { "@type": "Organization", name: "{{name}}" },
        publisher: {
          "@type": "Organization",
          name: "{{name}}",
          logo: { "@type": "ImageObject", url: "[ADD LOGO URL]" },
        },
        datePublished: "[ADD ISO DATE e.g. 2026-01-15]",
        dateModified: "[ADD ISO DATE]",
        description: "[ADD SUMMARY]",
        mainEntityOfPage: "{{url}}",
      },
      null,
      2
    ),
  },
  {
    type: "faqpage",
    label: "FAQPage",
    description: "Q&A blocks — the highest-yield schema for being quoted verbatim in AI answers.",
    required: ["@type", "mainEntity"],
    recommended: [],
    template: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "[ADD QUESTION 1]",
            acceptedAnswer: { "@type": "Answer", text: "[ADD ANSWER 1]" },
          },
          {
            "@type": "Question",
            name: "[ADD QUESTION 2]",
            acceptedAnswer: { "@type": "Answer", text: "[ADD ANSWER 2]" },
          },
        ],
      },
      null,
      2
    ),
  },
  {
    type: "howto",
    label: "HowTo",
    description: "Step-by-step instructions — engines lift structured steps into answers.",
    required: ["@type", "name", "step"],
    recommended: [],
    template: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "[ADD TASK NAME]",
        step: [
          { "@type": "HowToStep", name: "[ADD STEP 1 NAME]", text: "[ADD STEP 1 INSTRUCTION]" },
          { "@type": "HowToStep", name: "[ADD STEP 2 NAME]", text: "[ADD STEP 2 INSTRUCTION]" },
        ],
      },
      null,
      2
    ),
  },
  {
    type: "localbusiness",
    label: "LocalBusiness",
    description: "Physical locations — NAP (name/address/phone) + geo for local-AI answers.",
    required: ["@type", "name"],
    recommended: ["address", "telephone", "url"],
    template: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "{{name}}",
        url: "{{url}}",
        address: {
          "@type": "PostalAddress",
          streetAddress: "[ADD STREET]",
          addressLocality: "[ADD CITY]",
          addressRegion: "[ADD STATE]",
          postalCode: "[ADD PINCODE]",
          addressCountry: "IN",
        },
        telephone: "[ADD PHONE]",
        geo: { "@type": "GeoCoordinates", latitude: "[ADD LAT]", longitude: "[ADD LON]" },
        openingHours: "[ADD e.g. Mo-Fr 09:00-18:00]",
        priceRange: "[ADD e.g. ₹₹]",
      },
      null,
      2
    ),
  },
  {
    type: "breadcrumblist",
    label: "BreadcrumbList",
    description: "Page hierarchy — helps engines understand site structure and internal links.",
    required: ["@type", "itemListElement"],
    recommended: [],
    template: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "[ADD LEVEL 1]", item: "{{url}}" },
          { "@type": "ListItem", position: 2, name: "[ADD LEVEL 2]", item: "[ADD CHILD URL]" },
        ],
      },
      null,
      2
    ),
  },
];

export function getSchemaTemplate(type: SchemaType): SchemaTemplate | null {
  return SCHEMA_TEMPLATES.find((t) => t.type === type) ?? null;
}

export function listSchemaTemplates(): SchemaTemplate[] {
  return SCHEMA_TEMPLATES;
}

// Fill brand-known facts into a template; owner-only specifics stay as [ADD …].
export function generateSchemaForBrand(params: {
  type: SchemaType;
  brandName: string;
  domain: string;
}): string {
  const tpl = getSchemaTemplate(params.type);
  if (!tpl) return "";
  return tpl.template
    .replace(/\{\{name\}\}/g, params.brandName)
    .replace(/\{\{url\}\}/g, params.domain);
}

const REQUIRED_BY_TYPE: Record<string, string[]> = {
  organization: ["name", "url"],
  product: ["name"],
  article: ["headline", "author"],
  faqpage: ["mainEntity"],
  howto: ["name", "step"],
  localbusiness: ["name"],
  breadcrumblist: ["itemListElement"],
};

export function validateJsonLd(input: string): SchemaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return {
      valid: false,
      errors: ["Invalid JSON: " + (e instanceof Error ? e.message : "parse error")],
      warnings,
      type: null,
    };
  }

  const node = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!node || typeof node !== "object") {
    return {
      valid: false,
      errors: ["Top-level JSON-LD must be an object or an array of objects."],
      warnings,
      type: null,
    };
  }

  const obj = node as Record<string, unknown>;
  const graphNode =
    Array.isArray(obj["@graph"]) && obj["@graph"].length > 0
      ? (obj["@graph"][0] as Record<string, unknown>)
      : obj;
  const type = (obj["@type"] ?? graphNode["@type"] ?? null) as string | null;

  if (!obj["@context"]) errors.push("Missing @context (should be https://schema.org).");
  else if (typeof obj["@context"] === "string" && !/schema\.org/i.test(obj["@context"]))
    warnings.push("@context is not schema.org.");

  if (!type) errors.push("Missing @type.");

  const t = String(type ?? "").toLowerCase();
  const required = REQUIRED_BY_TYPE[t] ?? [];
  for (const f of required) {
    // Validate against the resolved entity node — for @graph docs that is the
    // inner entry, otherwise the top-level object itself.
    const v = graphNode[f];
    if (v === undefined || v === null || v === "") {
      errors.push(`Missing required field: ${f}.`);
    } else if (typeof v === "string" && PLACEHOLDER_RE.test(v)) {
      warnings.push(`Field "${f}" still contains a placeholder: "${v}". Fill it before publishing.`);
    }
  }

  const tpl = SCHEMA_TEMPLATES.find((x) => x.type === t);
  if (tpl) {
    for (const f of tpl.recommended) {
      const v = obj[f];
      if (v === undefined || v === null || v === "") warnings.push(`Missing recommended field: ${f}.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, type: type ? String(type) : null };
}
