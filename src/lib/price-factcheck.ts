// ============================================================
// Ecommerce Price / Stock Fact-Check (Batch 31)
//
// Measures how visible a store is inside AI product answers and
// FACT-CHECKS the price/stock the AI asserts for the brand against
// the brand's TRUE feed values, then ranks the brand against the
// competing retailers the AI actually names.
//
// Honesty design:
//  - Brand presence is a DETERMINISTIC check (deterministicMentionCheck),
//    never the LLM's self-report.
//  - Engine sampling uses callEngine with per-engine failure isolation
//    (Promise.allSettled) — a missing key returns a clean note, not a
//    failure of the whole request.
//  - If OPENAI_API_KEY is absent we degrade to the deterministic brand
//    check + raw snippet (no fabricated retailer extraction).
//  - This is analysis/generation only: nothing is persisted (like the
//    other stateless GEO tools), so it is deliberately excluded from the
//    shared PDF report path.
// ============================================================

import { callEngine } from "@/lib/visibility-consistency";
import { deterministicMentionCheck } from "@/lib/mention-matcher";

export type RetailerMention = {
  name: string;
  priceStated?: string;
  citedUrl?: string;
  isBrand: boolean;
};

export type EnginePriceCheck = {
  engine: string;
  answered: boolean;
  brandMentioned: boolean;
  retailers: RetailerMention[];
  brandPriceStated?: string;
  brandInStockStated: boolean | null;
  cheapestRetailer?: string;
  snippet: string;
  note?: string;
};

export type PriceFactCheckResult = {
  productName: string;
  brandName: string;
  truePrice?: string;
  inStock?: boolean;
  engines: EnginePriceCheck[];
  brandMentionRate: number;
  priceMatch?: "match" | "mismatch" | "unknown";
  priceMatchDetail?: string;
  stockMatch?: "match" | "mismatch" | "unknown";
  stockMatchDetail?: string;
  competitorRetailers: string[];
  notes: string[];
};

const DEFAULT_ENGINES = ["chatgpt", "perplexity", "gemini"];

function parsePrice(s?: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function buildPrompt(productName: string, brandName: string): string {
  return [
    `A shopper asks an AI assistant: "Where can I buy ${productName}? Which retailers sell it, which is cheapest right now, and is ${brandName} in stock?"`,
    `Answer the shopper as the AI would, naming specific retailers/brands and any prices or stock status you state for ${brandName} and for competitors.`,
  ].join(" ");
}

type Extracted = {
  retailers: { name: string; priceStated?: string; citedUrl?: string }[];
  brandPriceStated?: string;
  brandInStockStated: boolean | null;
  cheapestRetailer?: string;
};

async function extractWithLlm(answer: string, brandName: string, productName: string): Promise<Extracted | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
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
            content:
              "Extract retailer mentions from an AI product-answer. Return JSON: { retailers:[{name,priceStated,citedUrl}], brandPriceStated, brandInStockStated (boolean|null), cheapestRetailer }. brandInStockStated is what the answer claims about availability of the brand's product (true=in stock, false=out of stock, null=not stated).",
          },
          {
            role: "user",
            content: `Brand: ${brandName}\nProduct: ${productName}\nAnswer:\n${answer}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0].message.content) as Extracted;
    return parsed;
  } catch {
    return null;
  }
}

export async function runPriceFactCheck(params: {
  brandName: string;
  productName: string;
  truePrice?: string;
  inStock?: boolean;
  engines?: string[];
}): Promise<PriceFactCheckResult> {
  const { brandName, productName, truePrice, inStock } = params;
  const engines = params.engines?.length ? params.engines : DEFAULT_ENGINES;
  const prompt = buildPrompt(productName, brandName);

  const engineResults = await Promise.allSettled(
    engines.map(async (engine): Promise<EnginePriceCheck> => {
      let answer: string;
      try {
        answer = await callEngine(engine, prompt);
      } catch (err) {
        return {
          engine,
          answered: false,
          brandMentioned: false,
          retailers: [],
          brandInStockStated: null,
          snippet: "",
          note: (err as Error).message,
        };
      }

      const brandMentioned = deterministicMentionCheck(answer, brandName);
      const extracted = await extractWithLlm(answer, brandName, productName);

      const retailers: RetailerMention[] = (extracted?.retailers ?? []).map((r) => ({
        name: r.name,
        priceStated: r.priceStated,
        citedUrl: r.citedUrl,
        isBrand: deterministicMentionCheck(r.name, brandName),
      }));

      return {
        engine,
        answered: true,
        brandMentioned,
        retailers,
        brandPriceStated: extracted?.brandPriceStated,
        brandInStockStated: extracted?.brandInStockStated ?? null,
        cheapestRetailer: extracted?.cheapestRetailer,
        snippet: answer.slice(0, 280),
      };
    })
  );

  const enginesOut: EnginePriceCheck[] = engineResults.map((r, i) =>
    r.status === "fulfilled" ? r.value : { engine: engines[i], answered: false, brandMentioned: false, retailers: [], brandInStockStated: null, snippet: "", note: "Engine check failed." }
  );

  const answered = enginesOut.filter((e) => e.answered);
  const mentioned = answered.filter((e) => e.brandMentioned).length;
  const brandMentionRate = answered.length ? mentioned / answered.length : 0;

  const competitorRetailers = Array.from(
    new Set(
      enginesOut
        .flatMap((e) => e.retailers)
        .filter((r) => !r.isBrand)
        .map((r) => r.name)
    )
  );

  // Fact-check price across answered engines that stated a brand price.
  let priceMatch: PriceFactCheckResult["priceMatch"] = "unknown";
  let priceMatchDetail: string | undefined;
  const trueP = parsePrice(truePrice);
  if (trueP != null) {
    const stated = enginesOut
      .map((e) => parsePrice(e.brandPriceStated))
      .filter((n): n is number => n != null);
    if (stated.length) {
      const mismatches = stated.filter((n) => Math.abs(n - trueP) / trueP > 0.02);
      priceMatch = mismatches.length ? "mismatch" : "match";
      priceMatchDetail = `Your feed price: ${truePrice}. AI stated: ${stated
        .map((n) => String(n))
        .join(", ")}.`;
    }
  }

  // Fact-check stock.
  let stockMatch: PriceFactCheckResult["stockMatch"] = "unknown";
  let stockMatchDetail: string | undefined;
  const statedStock = enginesOut.map((e) => e.brandInStockStated).filter((s): s is boolean => s !== null);
  if (typeof inStock === "boolean" && statedStock.length) {
    const mismatches = statedStock.filter((s) => s !== inStock);
    stockMatch = mismatches.length ? "mismatch" : "match";
    stockMatchDetail = `Your feed: ${inStock ? "in stock" : "out of stock"}. AI stated: ${statedStock
      .map((s) => (s ? "in stock" : "out of stock"))
      .join(", ")}.`;
  }

  return {
    productName,
    brandName,
    truePrice,
    inStock,
    engines: enginesOut,
    brandMentionRate,
    priceMatch,
    priceMatchDetail,
    stockMatch,
    stockMatchDetail,
    competitorRetailers,
    notes: [
      "Brand presence is a deterministic name check, not the AI's self-report. Price/stock are fact-checked against the feed values you supplied.",
      "Analysis only — nothing is persisted. Connect a product feed to automate this across your catalog.",
    ],
  };
}
