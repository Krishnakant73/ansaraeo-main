// Simple, no-API-key-needed starter prompt generator.
// Ref: 01-master-roadmap.md Phase 1 — "auto-suggest 20-30 starter prompts"
// and 05-ui-ux-design-system.md Screen A (Onboarding Wizard).
//
// EN/HI prompts come from built-in native templates (no API key needed).
// For every other Indian language we call the LLM (gpt-4o-mini) to produce
// native-language prompts — this is the upgrade path the original comment
// anticipated ("once OPENAI_API_KEY is live, you can upgrade ... to call an
// LLM"). The function is async and its signature is stable, so the onboarding
// route only needed to `await` it. We never machine-translate: EN/HI are
// hand-written templates, everything else is generated natively by the model.

import { getInternalLLM } from "@/lib/llm";
import { languageName } from "./languages";
import { inferIntentFromText } from "./intent";

export type IndustryKey =
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

async function generateViaLLM(
  params: { industry: IndustryKey; category: string; competitor?: string; city?: string },
  lang: string
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  try {
    const native = languageName(lang);
    const industryLabel = INDUSTRIES.find((i) => i.value === params.industry)?.label ?? params.industry;
    const raw = await getInternalLLM().generate({
      system: `You generate realistic, native-language search queries that people in India ask AI answer engines (ChatGPT, Perplexity, Gemini). Respond ONLY as JSON: {"prompts": string[]}.`,
      prompt: `Generate 5 short, natural ${native}-language search queries a customer would ask an AI assistant about "${params.category}"${
        params.competitor ? `, comparing it to ${params.competitor}` : ""
      }${params.city ? `, in ${params.city}` : ""}. Industry: ${industryLabel}. Write them exactly as a native ${native} speaker would type them — not translated English. Return ONLY the JSON object.`,
      json: true,
    });
    const parsed = JSON.parse(raw ?? "{}");
    return Array.isArray(parsed?.prompts) ? parsed.prompts.slice(0, 6).map(String) : [];
  } catch {
    return [];
  }
}

export async function generateStarterPrompts(params: {
  industry: IndustryKey;
  category: string; // e.g. "sneakers", "protein powder" — user types this in onboarding
  competitor?: string;
  city?: string;
  languages: string[];
}): Promise<{ text: string; language: string; intent: string }[]> {
  const set = TEMPLATES[params.industry] ?? TEMPLATES.other;
  const prompts: { text: string; language: string; intent: string }[] = [];

  // EN/HI: built-in native templates (no API key needed).
  // Other languages: generate natively via the LLM when a key is present.
  const llmLangs: string[] = [];
  for (const lang of params.languages) {
    if (lang === "en" || lang === "hi") {
      const list = lang === "en" ? set.en : set.hi;
      for (const template of list) {
        const text = template
          .replace("{category}", params.category)
          .replace("{competitor}", params.competitor || "other brands")
          .replace("{city}", params.city || "India");
        prompts.push({ text, language: lang, intent: inferIntentFromText(text) });
      }
    } else if (process.env.OPENAI_API_KEY) {
      llmLangs.push(lang);
    }
    // Languages without a template AND without an API key yield no starter
    // prompts (consistent with empty-template industries like `saas.hi`).
  }

  if (llmLangs.length) {
    const generated = await Promise.all(llmLangs.map((l) => generateViaLLM(params, l)));
    generated.forEach((list, i) => {
      for (const text of list) prompts.push({ text, language: llmLangs[i], intent: inferIntentFromText(text) });
    });
  }

  return prompts;
}

// ============================================================
// generateScanPrompts — used by the public /api/analyze route.
//
// The pre-signup free scan runs only 3 prompts × 3 engines = 9 answers,
// so we pick the highest-value English prompts that cover: (a) a broad
// discovery prompt ("best X in India"), (b) a comparison prompt ("X vs
// competitor"), and (c) an intent-specific prompt if we have a city or
// use-case. This uses the same industry templates as generateStarterPrompts
// so the free scan is honest about what a paid tracking suite would also
// track, not a demo-only prompt set.
//
// Returns exactly 3 prompts. If the industry has fewer than 3 English
// templates (edge case), pads with generic "best {category} in India" so
// the caller always gets 3.
// ============================================================
export function generateScanPrompts(params: {
  industry: IndustryKey;
  category: string;
  competitor?: string;
  city?: string;
}): { text: string; language: string; intent: string }[] {
  const set = TEMPLATES[params.industry] ?? TEMPLATES.other;
  const fill = (template: string) =>
    template
      .replace("{category}", params.category)
      .replace("{competitor}", params.competitor || "other brands")
      .replace("{city}", params.city || "India");

  const candidates: string[] = [];
  // 1. broad discovery
  const broad = set.en.find((t) => t.includes("best ") || t.includes("top ")) ?? "best {category} brands in India";
  candidates.push(fill(broad));
  // 2. comparison (only if we have a competitor)
  const versus = set.en.find((t) => t.includes("{competitor}") || t.includes(" vs "));
  if (versus) candidates.push(fill(versus));
  // 3. affordability / intent
  const intent = set.en.find(
    (t) => t.includes("affordable") || t.includes("where to buy") || t.includes("near me") || t.includes(params.city ? "{city}" : ""),
  );
  if (intent && !candidates.includes(fill(intent))) candidates.push(fill(intent));
  // Pad with any remaining templates until we have 3.
  for (const t of set.en) {
    const filled = fill(t);
    if (candidates.length >= 3) break;
    if (!candidates.includes(filled)) candidates.push(filled);
  }
  while (candidates.length < 3) {
    candidates.push(`best ${params.category} in India`);
  }
  return candidates.slice(0, 3).map((text) => ({
    text,
    language: "en",
    intent: inferIntentFromText(text),
  }));
}
