// ============================================================
// industry-taxonomy.ts — canonical benchmark dimension vocabularies.
//
// `brands.industry` is free-form text (any customer can type anything), so
// for anonymous, comparable benchmarks we normalize it to a small set of
// canonical keys before storing/aggregating. Same single-source-of-truth
// pattern as intent.ts / languages.ts. Deterministic, no IO, fully tested.
// ============================================================

export const INDUSTRY_KEYS = [
  "saas",
  "fintech",
  "healthcare",
  "ecommerce",
  "education",
  "real_estate",
  "travel",
  "d2c",
  "retail",
  "media",
  "legal",
  "manufacturing",
  "agency",
  "food_beverage",
  "automotive",
  "professional_services",
  "other",
] as const;

export type IndustryKey = (typeof INDUSTRY_KEYS)[number];

export type IndustryDef = { key: IndustryKey; label: string; aliases: string[] };

export const INDUSTRIES: IndustryDef[] = [
  { key: "saas", label: "SaaS / Software", aliases: ["software", "software as a service", "b2b saas", "saas company", "tech", "technology"] },
  { key: "fintech", label: "Fintech / Finance", aliases: ["finance", "financial services", "banking", "insurance", "lending", "payments", "wealth"] },
  { key: "healthcare", label: "Healthcare", aliases: ["health", "medical", "pharma", "pharmaceutical", "wellness", "clinic", "hospital"] },
  { key: "ecommerce", label: "E-commerce", aliases: ["e-commerce", "e commerce", "online store", "online retail", "marketplace", "shopify"] },
  { key: "education", label: "Education / EdTech", aliases: ["edtech", "e-learning", "elearning", "school", "coaching", "training", "courses"] },
  { key: "real_estate", label: "Real Estate", aliases: ["property", "realty", "real estate", "construction", "housing"] },
  { key: "travel", label: "Travel / Hospitality", aliases: ["hospitality", "tourism", "hotels", "airline", "flight", "trip"] },
  { key: "d2c", label: "D2C / Consumer Goods", aliases: ["dtc", "direct to consumer", "consumer goods", "fmcg", "cpg", "brand"] },
  { key: "retail", label: "Retail", aliases: ["store", "shopping", "offline retail", "brick and mortar"] },
  { key: "media", label: "Media / Publishing", aliases: ["news", "publishing", "content", "entertainment", "blog", "youtube"] },
  { key: "legal", label: "Legal", aliases: ["law", "law firm", "attorney", "advocate", "legal services"] },
  { key: "manufacturing", label: "Manufacturing", aliases: ["factory", "industrial", "oem", "production"] },
  { key: "agency", label: "Agency / Marketing Services", aliases: ["marketing", "advertising", "seo agency", "creative", "consultancy", "consulting"] },
  { key: "food_beverage", label: "Food & Beverage", aliases: ["food", "beverage", "restaurant", "cafe", "qsr", "fnb"] },
  { key: "automotive", label: "Automotive", aliases: ["car", "vehicle", "auto", "mobility", "ev"] },
  { key: "professional_services", label: "Professional Services", aliases: ["services", "accounting", "ca", "audit", "staffing", "recruitment"] },
  { key: "other", label: "Other", aliases: [] },
];

const INDUSTRY_BY_ALIAS = new Map<string, IndustryKey>();
for (const ind of INDUSTRIES) {
  INDUSTRY_BY_ALIAS.set(ind.key, ind.key);
  INDUSTRY_BY_ALIAS.set(ind.label.toLowerCase(), ind.key);
  for (const a of ind.aliases) INDUSTRY_BY_ALIAS.set(a.toLowerCase(), ind.key);
}

/** Collapse free-form industry text to a canonical key. Unknown → "other". */
export function normalizeIndustry(input: string | null | undefined): IndustryKey {
  if (!input) return "other";
  const key = INDUSTRY_BY_ALIAS.get(input.trim().toLowerCase());
  return key ?? "other";
}

export function industryLabel(key: IndustryKey | string | null | undefined): string {
  if (!key) return "Other";
  return INDUSTRIES.find((i) => i.key === key)?.label ?? "Other";
}

// ---------- Region (derived from country) ----------

export const REGION_KEYS = [
  "south_asia",
  "southeast_asia",
  "east_asia",
  "middle_east",
  "europe",
  "north_america",
  "latin_america",
  "oceania",
  "africa",
  "global",
] as const;

export type RegionKey = (typeof REGION_KEYS)[number];

const COUNTRY_REGION: Record<string, RegionKey> = {
  // South Asia
  in: "south_asia", india: "south_asia", lk: "south_asia", pk: "south_asia", bd: "south_asia", np: "south_asia",
  // Southeast Asia
  sg: "southeast_asia", my: "southeast_asia", id: "southeast_asia", th: "southeast_asia",
  ph: "southeast_asia", vn: "southeast_asia",
  // East Asia
  jp: "east_asia", cn: "east_asia", kr: "east_asia",
  // Middle East
  ae: "middle_east", sa: "middle_east", qa: "middle_east", il: "middle_east",
  // Europe
  gb: "europe", uk: "europe", ie: "europe", de: "europe", fr: "europe", es: "europe",
  it: "europe", nl: "europe", se: "europe", ch: "europe",
  // North America
  us: "north_america", usa: "north_america", ca: "north_america",
  // Latin America
  br: "latin_america", mx: "latin_america", ar: "latin_america",
  // Oceania
  au: "oceania", nz: "oceania",
  // Africa
  za: "africa", ng: "africa", ke: "africa", eg: "africa",
};

export const REGION_LABELS: Record<RegionKey, string> = {
  south_asia: "South Asia",
  southeast_asia: "Southeast Asia",
  east_asia: "East Asia",
  middle_east: "Middle East",
  europe: "Europe",
  north_america: "North America",
  latin_america: "Latin America",
  oceania: "Oceania",
  africa: "Africa",
  global: "Global",
};

/** Map a country code/name to a region. Unknown / empty → "global". */
export function countryToRegion(country: string | null | undefined): RegionKey {
  if (!country) return "global";
  const c = country.trim().toLowerCase();
  return COUNTRY_REGION[c] ?? "global";
}

export function regionLabel(key: RegionKey | string | null | undefined): string {
  if (!key) return "Global";
  return REGION_LABELS[key as RegionKey] ?? "Global";
}

// ---------- Enrichment enums (optional, nullable on brands) ----------

export const COMPANY_SIZES = ["solo", "startup", "smb", "mid_market", "enterprise"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];
export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  solo: "Solo / Founder",
  startup: "Startup (1-10)",
  smb: "SMB (11-200)",
  mid_market: "Mid-market (201-1000)",
  enterprise: "Enterprise (1000+)",
};

export const TRAFFIC_BANDS = ["low", "medium", "high", "very_high"] as const;
export type TrafficBand = (typeof TRAFFIC_BANDS)[number];
export const TRAFFIC_BAND_LABELS: Record<TrafficBand, string> = {
  low: "Low (<10k/mo)",
  medium: "Medium (10k-100k/mo)",
  high: "High (100k-1M/mo)",
  very_high: "Very High (>1M/mo)",
};

export const REVENUE_BANDS = ["pre_revenue", "lt_1cr", "1_10cr", "10_50cr", "50cr_plus"] as const;
export type RevenueBand = (typeof REVENUE_BANDS)[number];
export const REVENUE_BAND_LABELS: Record<RevenueBand, string> = {
  pre_revenue: "Pre-revenue",
  lt_1cr: "< ₹1 Cr / yr",
  "1_10cr": "₹1-10 Cr / yr",
  "10_50cr": "₹10-50 Cr / yr",
  "50cr_plus": "> ₹50 Cr / yr",
};

/** Validate a free-form value against an allowed set; null-safe. */
export function coerceEnum<T extends readonly string[]>(
  allowed: T,
  value: string | null | undefined,
): T[number] | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T[number]) : null;
}
