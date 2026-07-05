// Simple, no-API-key-needed starter prompt generator.
// Ref: 01-master-roadmap.md Phase 1 — "auto-suggest 20-30 starter prompts"
// and 05-ui-ux-design-system.md Screen A (Onboarding Wizard).
//
// This is intentionally template-based (not LLM-generated) so onboarding
// works even before you've wired up any LLM API keys. Once OPENAI_API_KEY
// is live, you can upgrade generateStarterPrompts() to call an LLM instead
// for smarter, less generic suggestions — the function signature below is
// designed so that swap doesn't require changing any calling code.

type IndustryKey =
  | "d2c_fashion"
  | "d2c_beauty"
  | "d2c_food"
  | "saas"
  | "local_service"
  | "other";

export const INDUSTRIES: { value: IndustryKey; label: string }[] = [
  { value: "d2c_fashion", label: "D2C Fashion / Apparel" },
  { value: "d2c_beauty", label: "D2C Beauty / Skincare" },
  { value: "d2c_food", label: "D2C Food / Beverage" },
  { value: "saas", label: "SaaS / B2B Software" },
  { value: "local_service", label: "Local Service Business" },
  { value: "other", label: "Other" },
];

const TEMPLATES: Record<IndustryKey, { en: string[]; hi: string[] }> = {
  d2c_fashion: {
    en: [
      "best {category} brands in India",
      "affordable {category} online India",
      "{category} vs {competitor} which is better",
      "where to buy good quality {category} online",
      "top rated {category} brands for men",
      "top rated {category} brands for women",
      "sustainable {category} brands India",
    ],
    hi: [
      "sabse acche {category} brand kaunse hain",
      "sasta aur accha {category} online kahan milega",
      "{category} online shopping India mein best",
    ],
  },
  d2c_beauty: {
    en: [
      "best {category} for Indian skin",
      "{category} vs {competitor} comparison",
      "affordable {category} brands India",
      "best natural {category} brands",
      "top rated {category} on Amazon India",
    ],
    hi: [
      "sabse accha {category} kaunsa hai",
      "acha aur sasta {category} kahan milega",
      "{category} ke liye best brand batao",
    ],
  },
  d2c_food: {
    en: [
      "healthiest {category} brands India",
      "best tasting {category} online",
      "{category} vs {competitor} which is healthier",
      "where to order {category} online India",
    ],
    hi: [
      "sabse acha {category} brand kaunsa hai",
      "healthy {category} kahan se mangaye",
    ],
  },
  saas: {
    en: [
      "best {category} software for small business",
      "{category} vs {competitor}",
      "affordable {category} tool for startups India",
      "top {category} platforms 2026",
      "{category} software with best support",
    ],
    hi: [],
  },
  local_service: {
    en: [
      "best {category} near me",
      "top rated {category} in {city}",
      "affordable {category} service {city}",
      "{category} vs {competitor} reviews",
    ],
    hi: [
      "sabse acha {category} {city} mein kaunsa hai",
    ],
  },
  other: {
    en: [
      "best {category} brands in India",
      "{category} vs {competitor}",
      "top rated {category} 2026",
    ],
    hi: [],
  },
};

export function generateStarterPrompts(params: {
  industry: IndustryKey;
  category: string; // e.g. "sneakers", "protein powder" — user types this in onboarding
  competitor?: string;
  city?: string;
  languages: ("en" | "hi")[];
}): { text: string; language: "en" | "hi" }[] {
  const set = TEMPLATES[params.industry] ?? TEMPLATES.other;
  const prompts: { text: string; language: "en" | "hi" }[] = [];

  for (const lang of params.languages) {
    const list = lang === "en" ? set.en : set.hi;
    for (const template of list) {
      const text = template
        .replace("{category}", params.category)
        .replace("{competitor}", params.competitor || "other brands")
        .replace("{city}", params.city || "India");
      prompts.push({ text, language: lang });
    }
  }
  return prompts;
}
