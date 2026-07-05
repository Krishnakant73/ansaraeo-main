import * as cheerio from "cheerio";

// ============================================================
// Site Audit Engine (Part 4, Tier 4 / Part 9, Section B)
//
// Checks, in order of how much they actually affect AI citability:
// 1. AI-bot crawlability (robots.txt blocking GPTBot/PerplexityBot/etc.
//    is the single most damaging, most common, and most invisible issue —
//    many sites block these accidentally via a security plugin or CDN
//    default without realizing it)
// 2. llms.txt presence
// 3. Schema markup (JSON-LD) presence and which types
// 4. Basic on-page structure (H1, meta description)
// ============================================================

export type AuditIssue = {
  check: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  fix: string;
};

export type AuditResult = {
  overallScore: number;
  schemaMarkupScore: number;
  crawlabilityScore: number;
  llmsTxtPresent: boolean;
  issues: AuditIssue[];
};

const AI_BOTS = ["GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "anthropic-ai", "Google-Extended", "CCBot"];

async function safeFetch(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AnsarAEO-SiteAuditBot/1.0 (+https://ansaraeo.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    return res;
  } catch {
    return null;
  }
}

function normalizeUrl(domain: string): string {
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${clean}`;
}

export async function runSiteAudit(domain: string): Promise<AuditResult> {
  const baseUrl = normalizeUrl(domain);
  const issues: AuditIssue[] = [];

  // ---------- 1. robots.txt — AI bot crawlability ----------
  let crawlabilityScore = 100;
  const robotsRes = await safeFetch(`${baseUrl}/robots.txt`);
  if (robotsRes && robotsRes.ok) {
    const robotsText = await robotsRes.text();
    const blockedBots: string[] = [];

    // Very simplified robots.txt parsing: look for a User-agent block
    // for each known AI bot followed by a Disallow: / before the next
    // User-agent line.
    for (const bot of AI_BOTS) {
      const botBlockRegex = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?(?=User-agent:|$)`, "i");
      const match = robotsText.match(botBlockRegex);
      if (match && /Disallow:\s*\/\s*$/im.test(match[0])) {
        blockedBots.push(bot);
      }
    }

    if (blockedBots.length > 0) {
      crawlabilityScore = 30;
      issues.push({
        check: "AI bot crawlability",
        status: "fail",
        detail: `robots.txt blocks: ${blockedBots.join(", ")}. These AI crawlers cannot read your site at all.`,
        fix: `Remove the "Disallow: /" rule for ${blockedBots.join(", ")} in robots.txt, or add explicit "Allow: /" rules for them.`,
      });
    } else {
      issues.push({
        check: "AI bot crawlability",
        status: "pass",
        detail: "No AI crawlers are blocked in robots.txt.",
        fix: "No action needed.",
      });
    }
  } else {
    // No robots.txt at all is technically fine (nothing is blocked) but
    // worth flagging as a minor gap since it's also useful for stating
    // your sitemap location.
    crawlabilityScore = 80;
    issues.push({
      check: "AI bot crawlability",
      status: "warning",
      detail: "No robots.txt found. Nothing is being blocked, but you're missing a chance to explicitly welcome AI crawlers.",
      fix: "Add a robots.txt that explicitly allows GPTBot, PerplexityBot, ClaudeBot, and Google-Extended.",
    });
  }

  // ---------- 2. llms.txt ----------
  const llmsRes = await safeFetch(`${baseUrl}/llms.txt`);
  const llmsTxtPresent = !!(llmsRes && llmsRes.ok);
  issues.push({
    check: "llms.txt",
    status: llmsTxtPresent ? "pass" : "warning",
    detail: llmsTxtPresent ? "llms.txt is present." : "No llms.txt found.",
    fix: llmsTxtPresent
      ? "No action needed."
      : `Add a plain-Markdown llms.txt at ${baseUrl}/llms.txt summarizing your site's purpose and key pages.`,
  });

  // ---------- 3. Schema markup + on-page structure ----------
  let schemaMarkupScore = 0;
  const homepageRes = await safeFetch(baseUrl);
  const schemaTypesFound: string[] = [];
  let hasH1 = false;
  let hasMetaDescription = false;

  if (homepageRes && homepageRes.ok) {
    const html = await homepageRes.text();
    const $ = cheerio.load(html);

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).text());
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item["@type"]) schemaTypesFound.push(item["@type"]);
        }
      } catch {
        // malformed JSON-LD — ignore this block, don't crash the audit
      }
    });

    hasH1 = $("h1").length > 0;
    hasMetaDescription = $('meta[name="description"]').attr("content")?.trim().length ? true : false;

    if (schemaTypesFound.length === 0) {
      schemaMarkupScore = 20;
      issues.push({
        check: "Schema markup",
        status: "fail",
        detail: "No JSON-LD structured data found on the homepage.",
        fix: "Add Organization schema at minimum, plus Product/FAQPage schema on relevant pages.",
      });
    } else {
      const hasOrg = schemaTypesFound.some((t) => t.includes("Organization"));
      const hasProduct = schemaTypesFound.some((t) => t.includes("Product"));
      const hasFaq = schemaTypesFound.some((t) => t.includes("FAQPage"));
      schemaMarkupScore = 40 + (hasOrg ? 20 : 0) + (hasProduct ? 20 : 0) + (hasFaq ? 20 : 0);
      issues.push({
        check: "Schema markup",
        status: schemaMarkupScore >= 80 ? "pass" : "warning",
        detail: `Found: ${schemaTypesFound.join(", ")}.`,
        fix:
          schemaMarkupScore >= 80
            ? "No action needed."
            : `Consider adding${!hasOrg ? " Organization" : ""}${!hasProduct ? " Product" : ""}${!hasFaq ? " FAQPage" : ""} schema.`,
      });
    }

    issues.push({
      check: "Page structure (H1)",
      status: hasH1 ? "pass" : "fail",
      detail: hasH1 ? "Homepage has a clear H1." : "No H1 tag found on the homepage.",
      fix: hasH1 ? "No action needed." : "Add a single, clear H1 heading describing what your business does.",
    });

    issues.push({
      check: "Meta description",
      status: hasMetaDescription ? "pass" : "warning",
      detail: hasMetaDescription ? "Meta description present." : "No meta description found.",
      fix: hasMetaDescription ? "No action needed." : "Add a concise, honest meta description summarizing the page.",
    });
  } else {
    issues.push({
      check: "Homepage fetch",
      status: "fail",
      detail: "Could not fetch the homepage — check that the domain is correct and publicly accessible.",
      fix: "Verify the domain in Settings and make sure the site is live.",
    });
  }

  const overallScore = Math.round((schemaMarkupScore + crawlabilityScore) / 2);

  return { overallScore, schemaMarkupScore, crawlabilityScore, llmsTxtPresent, issues };
}
