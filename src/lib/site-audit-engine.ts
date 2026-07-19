import * as cheerio from "cheerio";

// ============================================================
// Site Audit Engine (Part 4, Tier 4 / Part 9, Section B)
//
// Checks, in order of how much they actually affect AI citability.
// Deepened in this batch to match the wider GEO field (per-bot crawler
// access, sitemap, freshness, heading/question structure, OG/meta,
// JS-render blank-page risk, BLUF density, E-E-A-T signals, and the
// newer AI discovery files llms-full.txt / .well-known/ai.json).
//
// The result is a scored AuditResult + a flat list of issues. The
// `issues` JSONB column on site_audits already carries every check, so
// adding new checks here is fully backward-compatible with stored rows
// and the existing dashboard UI — no schema migration required.
// ============================================================

export type AuditIssue = {
  check: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  fix: string;
  category?: string;
  // Optional AI-generated, copy-pasteable code/config snippet (Batch 26).
  fixSnippet?: string;
};

export type AuditCategoryScore = {
  name: string;
  score: number;
  issueCount: number;
};

export type AuditResult = {
  overallScore: number;
  schemaMarkupScore: number;
  crawlabilityScore: number;
  llmsTxtPresent: boolean;
  issues: AuditIssue[];
  // Optional extras (Batch 25) — the site_audits row only stores the four
  // scalar scores + issues JSONB, so these ride along in memory / the API
  // response without any schema change.
  grade?: string;
  categories?: AuditCategoryScore[];
};

// Buckets every check into a category for the composite scorecard. Falls
// back to "Other" for anything unmapped so new checks never disappear.
function categorize(check: string): string {
  const c = check.toLowerCase();
  if (c.includes("crawlab") || c.includes("sitemap") || c.includes("robots")) return "Crawlability";
  if (c.includes("llms") || c.includes("discovery") || c.includes("ai.json")) return "AI Discovery";
  if (c.includes("schema") || c.includes("json-ld") || c.includes("structured")) return "Structured Data";
  if (c.includes("security") || c.includes("header") || c.includes("https")) return "Security";
  if (c.includes("performance") || c.includes("render") || c.includes("image") || c.includes("weight")) return "Performance";
  if (c.includes("e-e-a-t") || c.includes("eeat") || c.includes("author")) return "E-E-A-T";
  if (c.includes("provenance")) return "Provenance";
  if (c.includes("agent-readiness") || c.includes("webmcp") || c.includes("mcp")) return "Agent-readiness";
  if (c.includes("citability")) return "Citability";
  if (c.includes("topical")) return "Topical Authority";
  if (c.includes("hidden") || c.includes("prompt-injection") || c.includes("integrity")) return "Integrity";
  return "Content & Structure";
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

// The full set of AI/LLM crawlers that matter for GEO. Blocking any of
// these (accidentally, via a security plugin or CDN default) is the single
// most damaging and most invisible issue a site can have.
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "PerplexityBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
  "Amazonbot",
  "Bytespider",
  "Applebot",
  "Bingbot",
  "Diffbot",
  "Baiduspider",
];

const STATUS_VALUE: Record<AuditIssue["status"], number> = { pass: 100, warning: 55, fail: 0 };

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

// Returns the robots.txt block (all lines up to the next User-agent) for a
// given bot, or null if there's no explicit block for it.
function getRobotsBlockForBot(robotsText: string, bot: string): string | null {
  const blockRegex = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?(?=User-agent:|$)`, "i");
  const match = robotsText.match(blockRegex);
  return match ? match[0] : null;
}

// A bot is "blocked" if its block contains a Disallow with a non-empty
// path. `Disallow:` (empty) means "allow everything", so it does NOT count.
function isBotBlocked(block: string): boolean {
  const disallowLines = block.match(/Disallow:\s*(\S+)/gi) ?? [];
  return disallowLines.some((line) => {
    const path = line.replace(/Disallow:\s*/i, "").trim();
    return path.length > 0;
  });
}

// Parse the most plausible "last updated" date out of schema / meta / <time>.
function extractPublishedDate($: cheerio.CheerioAPI): string | null {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const json = JSON.parse($(el).text());
      const items = Array.isArray(json) ? json : json["@graph"] ? json["@graph"] : [json];
      for (const item of items) {
        const d = item?.dateModified || item?.datePublished || item?.dateCreated;
        if (d) return String(d);
      }
    } catch {
      /* malformed JSON-LD — ignore */
    }
  }
  const metaDate =
    $('meta[property="article:modified_time"]').attr("content") ||
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content");
  if (metaDate) return metaDate;
  const timeEl = $("time[datetime]").first().attr("datetime");
  if (timeEl) return timeEl;
  return null;
}

function daysSince(dateStr: string): number | null {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export async function runSiteAudit(domain: string): Promise<AuditResult> {
  const baseUrl = normalizeUrl(domain);
  const issues: AuditIssue[] = [];

  // ---------- 1. robots.txt — per-bot AI crawler access ----------
  let crawlabilityScore = 100;
  const robotsRes = await safeFetch(`${baseUrl}/robots.txt`);
  let blockedBots: string[] = [];
  let allowedBots: string[] = [];

  if (robotsRes && robotsRes.ok) {
    const robotsText = await robotsRes.text();
    for (const bot of AI_BOTS) {
      const block = getRobotsBlockForBot(robotsText, bot);
      if (block && isBotBlocked(block)) blockedBots.push(bot);
      else allowedBots.push(bot);
    }
  } else {
    // No robots.txt => nothing is explicitly blocked, but we lose the
    // chance to welcome crawlers and declare the sitemap.
    allowedBots = [...AI_BOTS];
    crawlabilityScore = 80;
  }

  if (blockedBots.length > 0) {
    crawlabilityScore = Math.max(20, 100 - Math.round((blockedBots.length / AI_BOTS.length) * 80));
    issues.push({
      check: "AI bot crawlability",
      status: "fail",
      detail: `robots.txt blocks ${blockedBots.length}/${AI_BOTS.length} AI crawlers: ${blockedBots.join(", ")}. These bots cannot read your site.`,
      fix: `Remove the blocking "Disallow" rules for ${blockedBots.join(", ")} in robots.txt, or add explicit "Allow: /" rules for them.`,
    });
  } else {
    issues.push({
      check: "AI bot crawlability",
      status: "pass",
      detail: robotsRes?.ok
        ? `All ${allowedBots.length} tracked AI crawlers are allowed in robots.txt.`
        : "No robots.txt found. Nothing is blocked, but you can't explicitly welcome AI crawlers.",
      fix: robotsRes?.ok ? "No action needed." : "Add a robots.txt that explicitly allows GPTBot, PerplexityBot, ClaudeBot, and Google-Extended.",
    });
  }

  // ---------- 2. llms.txt (basic) ----------
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

  // ---------- 2b. llms-full.txt + .well-known/ai.json (newer AI discovery files) ----------
  const llmsFullRes = await safeFetch(`${baseUrl}/llms-full.txt`);
  const aiJsonRes = await safeFetch(`${baseUrl}/.well-known/ai.json`);
  const hasLlmsFull = !!(llmsFullRes && llmsFullRes.ok);
  const hasAiJson = !!(aiJsonRes && aiJsonRes.ok);
  if (hasLlmsFull || hasAiJson) {
    issues.push({
      check: "AI discovery files (llms-full.txt / ai.json)",
      status: "pass",
      detail: `Present: ${[hasLlmsFull ? "llms-full.txt" : null, hasAiJson ? ".well-known/ai.json" : null].filter(Boolean).join(", ")}.`,
      fix: "No action needed.",
    });
  } else {
    issues.push({
      check: "AI discovery files (llms-full.txt / ai.json)",
      status: "warning",
      detail: "Neither llms-full.txt nor .well-known/ai.json was found.",
      fix: "Optional but recommended: add llms-full.txt (full-site markdown for LLMs) and/or .well-known/ai.json (machine-readable site description) to complement llms.txt.",
    });
  }

  // ---------- 2c. Agent-readiness / WebMCP endpoint ----------
  // Some sites now expose an agent/tool endpoint (e.g. /.well-known/mcp) so
  // AI agents can take actions or pull structured data directly. This is an
  // emerging standard — informational only, not a pass/fail gate.
  const mcpRes = await safeFetch(`${baseUrl}/.well-known/mcp`);
  if (mcpRes && mcpRes.ok) {
    issues.push({
      check: "Agent-readiness (WebMCP)",
      status: "pass",
      detail: "Detected an agent endpoint at /.well-known/mcp — the site is reachable by AI agents for structured data/actions.",
      fix: "No action needed.",
      category: "Agent-readiness",
    });
  } else {
    issues.push({
      check: "Agent-readiness (WebMCP)",
      status: "warning",
      detail: "No agent endpoint (/.well-known/mcp) detected. Optional: expose a WebMCP/agent endpoint so AI agents can pull structured data or take actions directly.",
      fix: "Optional: publish an agent endpoint such as /.well-known/mcp describing the tools/actions your site exposes to AI agents.",
      category: "Agent-readiness",
    });
  }

  // ---------- 3. Schema markup + on-page structure ----------
  let schemaMarkupScore = 0;
  const homepageRes = await safeFetch(baseUrl);
  const schemaTypesFound: string[] = [];
  let hasH1 = false;
  let hasMetaDescription = false;
  let html = "";

  if (homepageRes && homepageRes.ok) {
    html = await homepageRes.text();
    const $ = cheerio.load(html);

    let sameAsCount = 0;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).text());
        const items = Array.isArray(json) ? json : json["@graph"] ? json["@graph"] : [json];
        for (const item of items) {
          if (item["@type"]) schemaTypesFound.push(item["@type"]);
          // Count entity-authority signals: sameAs links to social/KB profiles.
          const sa = item?.sameAs;
          if (Array.isArray(sa)) sameAsCount += sa.length;
          else if (typeof sa === "string" && sa.trim()) sameAsCount += 1;
        }
      } catch {
        /* malformed JSON-LD — ignore this block, don't crash the audit */
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

    // ---------- 3a1. Entity authority (sameAs footprint) ----------
    // AI engines resolve a brand to a knowledge entity via sameAs links in
    // schema.org (Social/KB profiles). A clear entity footprint helps them
    // trust and correctly attribute citations.
    if (sameAsCount >= 2) {
      issues.push({
        check: "Entity authority (sameAs)",
        status: "pass",
        detail: `Found ${sameAsCount} sameAs entity link(s) in structured data — a clear knowledge-graph footprint.`,
        fix: "No action needed.",
        category: "E-E-A-T",
      });
    } else if (sameAsCount === 1) {
      issues.push({
        check: "Entity authority (sameAs)",
        status: "warning",
        detail: "Only 1 sameAs entity link found in structured data. A richer entity footprint helps AI engines attribute your brand correctly.",
        fix: "Add more sameAs links (LinkedIn, Wikipedia, Crunchbase, X/Twitter) to your Organization/Person JSON-LD.",
        category: "E-E-A-T",
      });
    } else {
      issues.push({
        check: "Entity authority (sameAs)",
        status: "warning",
        detail: "No sameAs entity links found in structured data. AI engines have no explicit knowledge-graph connection for your brand.",
        fix: "Add a sameAs array (LinkedIn, Wikipedia, Crunchbase, X/Twitter) to your Organization/Person JSON-LD so AI engines can resolve your entity.",
        category: "E-E-A-T",
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

    // ---------- 3b. Heading hierarchy + question-format headings ----------
    const h1Count = $("h1").length;
    const headingLevels: number[] = [];
    for (const lvl of [1, 2, 3, 4, 5, 6]) {
      if ($(`h${lvl}`).length > 0) headingLevels.push(lvl);
    }
    let skippedLevel = false;
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) skippedLevel = true;
    }
    if (h1Count === 1 && !skippedLevel) {
      issues.push({
        check: "Heading hierarchy",
        status: "pass",
        detail: "Single H1 with no skipped heading levels.",
        fix: "No action needed.",
      });
    } else {
      issues.push({
        check: "Heading hierarchy",
        status: "fail",
        detail:
          h1Count === 0
            ? "No H1 found."
            : h1Count > 1
              ? `Found ${h1Count} H1 tags — should be exactly one.`
              : "Heading levels are skipped (e.g. H1 straight to H3).",
        fix: "Use exactly one H1 and never skip a heading level (H1 → H2 → H3 …).",
      });
    }

    const questionHeadings = $("h1, h2, h3, h4")
      .toArray()
      .filter((el) => {
        const t = $(el).text().trim().toLowerCase();
        return /\?$/.test(t) || /^(who|what|when|where|why|how)\b/.test(t);
      }).length;
    issues.push({
      check: "Question-format headings",
      status: questionHeadings > 0 ? "pass" : "warning",
      detail:
        questionHeadings > 0
          ? `${questionHeadings} question-format heading(s) detected — these boost AI citation likelihood.`
          : "No question-format headings found. FAQ-style headings are strongly favored by AI answer engines.",
      fix:
        questionHeadings > 0
          ? "No action needed."
          : "Add FAQ or 'How/What/Why' headings that mirror how users phrase queries to AI engines.",
    });

    // ---------- 3c. Content freshness ----------
    const dateStr = extractPublishedDate($);
    const ageDays = dateStr ? daysSince(dateStr) : null;
    if (ageDays === null) {
      issues.push({
        check: "Content freshness",
        status: "warning",
        detail: "No publish/modified date found in schema, meta, or <time> tags.",
        fix: "Add datePublished/dateModified to your JSON-LD and visible <time> tags so AI can judge recency.",
      });
    } else if (ageDays < 90) {
      issues.push({ check: "Content freshness", status: "pass", detail: `Content updated ${ageDays} days ago (fresh).`, fix: "No action needed." });
    } else if (ageDays <= 365) {
      issues.push({ check: "Content freshness", status: "warning", detail: `Content last updated ${ageDays} days ago (aging).`, fix: "Refresh key pages at least quarterly to signal active maintenance to AI engines." });
    } else {
      issues.push({ check: "Content freshness", status: "fail", detail: `Content last updated ${ageDays} days ago (stale).`, fix: "Update this content — stale pages are deprioritized by AI answer engines." });
    }

    // ---------- 3d. OpenGraph / meta completeness ----------
    const ogChecks = {
      "og:title": $('meta[property="og:title"]').attr("content")?.trim(),
      "og:description": $('meta[property="og:description"]').attr("content")?.trim(),
      "og:type": $('meta[property="og:type"]').attr("content")?.trim(),
      "og:image": $('meta[property="og:image"]').attr("content")?.trim(),
      canonical: $('link[rel="canonical"]').attr("href")?.trim(),
      "meta author": $('meta[name="author"]').attr("content")?.trim(),
    };
    const ogPresent = Object.values(ogChecks).filter(Boolean).length;
    issues.push({
      check: "OpenGraph & meta completeness",
      status: ogPresent >= 5 ? "pass" : ogPresent >= 3 ? "warning" : "fail",
      detail: `${ogPresent}/6 present (${Object.entries(ogChecks).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}).`,
      fix: ogPresent >= 5 ? "No action needed." : "Add og:title, og:description, og:type, og:image, a canonical link, and a meta author tag.",
    });

    // ---------- 3e. JS-render / blank-page risk ----------
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const textLen = bodyText.length;
    // If there's a lot of HTML but almost no rendered text, the page likely
    // depends on client-side JS — and AI crawlers may see a blank page.
    const htmlLen = html.length;
    const textRatio = htmlLen > 0 ? textLen / htmlLen : 1;
    if (textLen < 300 || textRatio < 0.05) {
      issues.push({
        check: "JS-render / blank-page risk",
        status: "warning",
        detail: `Homepage renders only ~${textLen} chars of text (${Math.round(textRatio * 100)}% of HTML). Core content may be injected by JavaScript and invisible to AI crawlers.`,
        fix: "Server-render key content (or use SSR/SSG) so AI bots get the real text, not an empty shell. Avoid hiding primary copy behind client-side rendering.",
      });
    } else {
      issues.push({
        check: "JS-render / blank-page risk",
        status: "pass",
        detail: `Homepage serves ${textLen} chars of static text — content is crawler-visible.`,
        fix: "No action needed.",
      });
    }

    // ---------- 3f. BLUF density (Bottom Line Up Front) ----------
    const firstP = $("p").first().text().trim();
    if (firstP.length >= 40 && firstP.length <= 400) {
      issues.push({
        check: "BLUF density (lead paragraph)",
        status: "pass",
        detail: "Opening paragraph is concise and present — AI can extract the core answer quickly.",
        fix: "No action needed.",
      });
    } else if (firstP.length > 0) {
      issues.push({
        check: "BLUF density (lead paragraph)",
        status: "warning",
        detail: `Opening paragraph is ${firstP.length} chars — too long or meandering for a clean AI extract.`,
        fix: "Lead with a 40–400 character bottom-line-up-front summary of what the page answers.",
      });
    } else {
      issues.push({
        check: "BLUF density (lead paragraph)",
        status: "warning",
        detail: "No clear lead paragraph found to anchor AI extraction.",
        fix: "Add a concise intro paragraph stating the page's core answer first.",
      });
    }

    // ---------- 3g. E-E-A-T signals ----------
    const hasPersonSchema = schemaTypesFound.some((t) => t.includes("Person") || t.includes("Author"));
    const metaAuthor = $('meta[name="author"]').attr("content")?.trim();
    const hasAboutContact = $('a[href*="about"], a[href*="contact"], a[href*="author"]').length > 0;
    const authoritativeOutbound = $('a[href*=".gov"], a[href*=".edu"]').length;
    const eeatScore = (hasPersonSchema ? 1 : 0) + (metaAuthor ? 1 : 0) + (hasAboutContact ? 1 : 0) + (authoritativeOutbound > 0 ? 1 : 0);
    issues.push({
      check: "E-E-A-T signals",
      status: eeatScore >= 3 ? "pass" : eeatScore >= 1 ? "warning" : "fail",
      detail: `Author/persona schema: ${hasPersonSchema ? "yes" : "no"} · meta author: ${metaAuthor ? "yes" : "no"} · About/Contact links: ${hasAboutContact ? "yes" : "no"} · .gov/.edu citations: ${authoritativeOutbound}.`,
      fix:
        eeatScore >= 3
          ? "No action needed."
          : "Add author bylines + Person schema, an About/Contact page, and cite authoritative (.gov/.edu) sources to build AI trust.",
    });

    // ---------- 3g1. Hidden-text / prompt-injection detection (defensive) ----------
    // AI crawlers and users cannot see text that is hidden via CSS/ARIA, but
    // it can still manipulate an AI's extraction or get the site penalized.
    const hidden = detectHiddenText(html);
    if (hidden.count > 0) {
      issues.push({
        check: "Hidden-text / prompt-injection risk",
        status: "fail",
        detail: `Found ${hidden.count} hidden-text / potential prompt-injection signal(s) in the homepage HTML (e.g. ${hidden.examples.slice(0, 3).join("; ")}). This text is invisible to users and AI crawlers but can manipulate extraction or trigger a spam penalty.`,
        fix: "Remove hidden text (display:none / visibility:hidden / opacity:0 / font-size:0 / aria-hidden blocks containing text / zero-width characters). If needed for legit UI, keep it out of the indexable content.",
        category: "Integrity",
      });
    } else {
      issues.push({
        check: "Hidden-text / prompt-injection risk",
        status: "pass",
        detail: "No hidden-text or prompt-injection patterns detected in the homepage HTML.",
        fix: "No action needed.",
        category: "Integrity",
      });
    }

    // ---------- 3g2. Citability score (composite of citable signals) ----------
    // A single 0-100 number summarizing how easily an AI engine could cite
    // this page, built from signals we already measured. It is a heuristic,
    // NOT a live engine ranking.
    const citHasQuestion = questionHeadings > 0;
    const citHasBluf = firstP.length >= 40 && firstP.length <= 400;
    const citHasSchema = schemaTypesFound.length > 0;
    const citFresh = ageDays !== null && ageDays < 365;
    let citability = 20 * (citHasQuestion ? 1 : 0) + 15 * (citHasBluf ? 1 : 0) + 20 * (citHasSchema ? 1 : 0) + Math.min(eeatScore, 4) * 8 + 13 * (citFresh ? 1 : 0);
    citability = Math.min(100, Math.round(citability));
    const citBits: string[] = [];
    if (citHasQuestion) citBits.push("question headings");
    if (citHasBluf) citBits.push("BLUF lead");
    if (citHasSchema) citBits.push("structured data");
    if (eeatScore >= 3) citBits.push("E-E-A-T signals");
    if (citFresh) citBits.push("freshness");
    issues.push({
      check: "Citability score",
      status: citability >= 70 ? "pass" : citability >= 45 ? "warning" : "fail",
      detail: `Citability ${citability}/100 — strengths: ${citBits.join(", ") || "none yet"}. Composite of citable signals (question headings, BLUF lead, schema, E-E-A-T, freshness); a heuristic, not a live engine ranking.`,
      fix: citability >= 70 ? "No action needed." : "Add FAQ/question headings, a BLUF intro, Organization/Product/FAQ schema, author E-E-A-T, and refresh content to improve AI citation likelihood.",
      category: "Citability",
    });

    // ---------- 3h. Security headers ----------
    // AI crawlers (and the search stacks behind them) increasingly treat
    // basic transport hygiene as a trust signal. Read straight off the
    // homepage response headers.
    const h = homepageRes.headers;
    const secHeaders = {
      "Strict-Transport-Security": h.get("strict-transport-security"),
      "X-Content-Type-Options": h.get("x-content-type-options"),
      "Content-Security-Policy": h.get("content-security-policy"),
      "X-Frame-Options": h.get("x-frame-options"),
    };
    const secPresent = Object.values(secHeaders).filter(Boolean).length;
    const missingSec = Object.entries(secHeaders).filter(([, v]) => !v).map(([k]) => k);
    issues.push({
      check: "Security headers",
      status: secPresent >= 3 ? "pass" : secPresent >= 1 ? "warning" : "fail",
      detail: `${secPresent}/4 present. ${missingSec.length ? `Missing: ${missingSec.join(", ")}.` : "All key headers set."}`,
      fix: secPresent >= 3 ? "No action needed." : `Add the missing security headers (${missingSec.join(", ")}) at your server/CDN — at minimum HSTS and X-Content-Type-Options: nosniff.`,
      category: "Security",
    });

    // ---------- 3h1. AI-provenance / content-usage-preference disclosure ----------
    // Emerging standards let a publisher signal how AI engines may use its
    // content (e.g. an `ai-provenance` response header or an ai-content-usage
    // meta tag). Not yet widely adopted, so this is informational — it flags
    // the absence rather than failing the audit.
    const provenanceHeader = h.get("ai-provenance") || h.get("x-ai-content-usage");
    const provenanceMeta =
      $('meta[name="ai-content-usage"]').attr("content") ||
      $('meta[name="ai-provenance"]').attr("content") ||
      $('meta[name="generator"]').attr("content");
    if (provenanceHeader || provenanceMeta) {
      issues.push({
        check: "AI provenance / usage disclosure",
        status: "pass",
        detail: "Found an AI-provenance / content-usage disclosure signal — the site declares how AI engines may attribute or use its content.",
        fix: "No action needed.",
        category: "Provenance",
      });
    } else {
      issues.push({
        check: "AI provenance / usage disclosure",
        status: "warning",
        detail: "No AI-provenance or content-usage-preference disclosure found (e.g. an `ai-provenance` header or `ai-content-usage` meta tag). These are emerging standards for telling AI engines how to attribute/use your content.",
        fix: "Optional: add an `ai-provenance` response header or an `ai-content-usage` meta tag declaring how AI engines may use and attribute this content.",
        category: "Provenance",
      });
    }

    // ---------- 3i. Performance: render-blocking scripts in <head> ----------
    const headBlockingScripts = $("head script[src]").filter((_, el) => {
      const s = $(el);
      return s.attr("async") === undefined && s.attr("defer") === undefined;
    }).length;
    issues.push({
      check: "Render-blocking scripts",
      status: headBlockingScripts === 0 ? "pass" : headBlockingScripts <= 2 ? "warning" : "fail",
      detail:
        headBlockingScripts === 0
          ? "No render-blocking scripts in <head>."
          : `${headBlockingScripts} synchronous <script> tag(s) in <head> can delay first paint — slow pages are crawled less thoroughly.`,
      fix: headBlockingScripts === 0 ? "No action needed." : "Add async or defer to non-critical <head> scripts, or move them before </body>.",
      category: "Performance",
    });

    // ---------- 3j. Performance: image alt + explicit dimensions ----------
    const imgs = $("img").toArray();
    if (imgs.length > 0) {
      const missingAlt = imgs.filter((el) => !$(el).attr("alt")?.trim()).length;
      const missingDims = imgs.filter((el) => !($(el).attr("width") && $(el).attr("height")) && !$(el).attr("srcset")).length;
      const altPct = Math.round((missingAlt / imgs.length) * 100);
      issues.push({
        check: "Image alt text",
        status: missingAlt === 0 ? "pass" : altPct <= 25 ? "warning" : "fail",
        detail:
          missingAlt === 0
            ? `All ${imgs.length} images have alt text.`
            : `${missingAlt}/${imgs.length} images (${altPct}%) are missing alt text — AI can't understand them.`,
        fix: missingAlt === 0 ? "No action needed." : "Add descriptive alt text to every meaningful image.",
        category: "Content & Structure",
      });
      issues.push({
        check: "Image dimensions (CLS)",
        status: missingDims === 0 ? "pass" : "warning",
        detail:
          missingDims === 0
            ? "Images declare width/height (or srcset) — good for layout stability."
            : `${missingDims}/${imgs.length} images lack explicit width/height, which can cause layout shift (CLS).`,
        fix: missingDims === 0 ? "No action needed." : "Set width and height attributes on images to reserve space and improve Core Web Vitals.",
        category: "Performance",
      });
    }

    // ---------- 3k. Page weight (proxy) ----------
    const htmlKb = Math.round(html.length / 1024);
    issues.push({
      check: "HTML document weight",
      status: htmlKb <= 150 ? "pass" : htmlKb <= 400 ? "warning" : "fail",
      detail: `Homepage HTML is ~${htmlKb} KB.`,
      fix: htmlKb <= 150 ? "No action needed." : "Trim inline scripts/styles and large embedded data; keep the HTML document lean so crawlers fetch it fully.",
      category: "Performance",
    });
  } else {
    issues.push({
      check: "Homepage fetch",
      status: "fail",
      detail: "Could not fetch the homepage — check that the domain is correct and publicly accessible.",
      fix: "Verify the domain in Settings and make sure the site is live.",
    });
  }

  // ---------- 4. sitemap.xml ----------
  const sitemapRes = await safeFetch(`${baseUrl}/sitemap.xml`);
  if (sitemapRes && sitemapRes.ok) {
    const sm = await sitemapRes.text();
    const urlCount = (sm.match(/<loc>/gi) ?? []).length;
    const lastmodCount = (sm.match(/<lastmod>/gi) ?? []).length;
    const hasLastmod = urlCount > 0 && lastmodCount / urlCount >= 0.5;
    issues.push({
      check: "sitemap.xml",
      status: urlCount > 0 ? (hasLastmod ? "pass" : "warning") : "fail",
      detail:
        urlCount > 0
          ? `sitemap.xml found with ${urlCount} URL(s); ${lastmodCount} include a <lastmod> date.`
          : "sitemap.xml exists but contains no <loc> URLs.",
      fix:
        urlCount > 0
          ? hasLastmod
            ? "No action needed."
            : "Add <lastmod> dates to sitemap URLs so AI/crawlers can judge freshness."
          : "Fix the sitemap so it lists your important page URLs.",
    });
  } else {
    issues.push({
      check: "sitemap.xml",
      status: "warning",
      detail: "No sitemap.xml found at the root.",
      fix: "Add a sitemap.xml (and reference it in robots.txt) so AI crawlers can discover all your pages.",
    });
  }

  // ---------- 5. Topical authority / pillar clustering ----------
  const topical = await analyzeTopicalAuthority(baseUrl);
  issues.push({
    check: "Topical authority (pillar clustering)",
    status: topical.status,
    detail: topical.detail,
    fix: topical.fix,
    category: "Topical Authority",
  });

  // ---------- 6. AI-generated fix snippets (optional, key-gated) ----------
  // Appends a copy-pasteable code/config snippet to each non-pass issue.
  await attachFixSnippets(issues);

  // Overall = mean of every check's status value, so new checks actually
  // move the score. The schema/crawlability cards still show their own sub-scores.
  const overallScore = Math.round(
    issues.reduce((sum, i) => sum + STATUS_VALUE[i.status], 0) / (issues.length || 1)
  );

  // ---------- Composite scorecard: per-category mean + letter grade ----------
  const byCategory = new Map<string, number[]>();
  for (const issue of issues) {
    const cat = issue.category ?? categorize(issue.check);
    const list = byCategory.get(cat) ?? [];
    list.push(STATUS_VALUE[issue.status]);
    byCategory.set(cat, list);
  }
  const categories: AuditCategoryScore[] = Array.from(byCategory.entries())
    .map(([name, vals]) => ({
      name,
      score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      issueCount: vals.length,
    }))
    .sort((a, b) => a.score - b.score);

  return {
    overallScore,
    schemaMarkupScore,
    crawlabilityScore,
    llmsTxtPresent,
    issues,
    grade: scoreToGrade(overallScore),
    categories,
  };
}

// Detect hidden text / prompt-injection patterns in raw HTML. We don't try to
// guess the background color, but the classic hiding techniques are unambiguous.
function detectHiddenText(html: string): { count: number; examples: string[] } {
  const examples: string[] = [];
  const hiddenStyleRe =
    /style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*0px|font-size\s*:\s*0\b|left\s*:\s*-9999px|position\s*:\s*absolute)[^"']*["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hiddenStyleRe.exec(html)) !== null && examples.length < 5) {
    examples.push(m[0].replace(/\s+/g, " ").slice(0, 80));
  }
  const ariaRe = /<[^>]*aria-hidden\s*=\s*["']true["'][^>]*>([\s\S]*?)<\//gi;
  while ((m = ariaRe.exec(html)) !== null && examples.length < 8) {
    const txt = m[1].replace(/<[^>]+>/g, " ").trim();
    if (txt.length > 0) examples.push(`aria-hidden text: "${txt.slice(0, 60)}"`);
  }
  const zeroWidth = (html.match(/[​­﻿]/g) || []).length;
  const count = examples.length + zeroWidth;
  return { count, examples };
}

// Assess whether the site's pages cluster into clear topical hubs (pillar/
// cluster structure), which AI engines favor for topical authority.
async function analyzeTopicalAuthority(baseUrl: string): Promise<{
  status: AuditIssue["status"];
  detail: string;
  fix: string;
}> {
  const smRes = await safeFetch(`${baseUrl}/sitemap.xml`);
  if (!smRes || !smRes.ok) {
    return {
      status: "warning",
      detail: "No sitemap.xml found — cannot assess topical clustering.",
      fix: "Add a sitemap.xml so crawlers (and this audit) can see your full page topology.",
    };
  }
  const xml = await smRes.text();
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi))
    .map((mm) => mm[1])
    .slice(0, 60);
  if (locs.length < 5) {
    return {
      status: "warning",
      detail: `Only ${locs.length} URLs in the sitemap — too few to assess topical clustering.`,
      fix: "Publish more topically-related pages and group them into clear hub/cluster structures.",
    };
  }
  const hubs = new Map<string, number>();
  for (const url of locs) {
    const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
    const seg = path.split("/").filter(Boolean)[0] || "root";
    hubs.set(seg, (hubs.get(seg) ?? 0) + 1);
  }
  const entries = Array.from(hubs.entries()).sort((a, b) => b[1] - a[1]);
  const largest = entries[0];
  const thinHubs = entries.filter(([, n]) => n < 3).length;
  if (largest[1] >= 3 && thinHubs <= entries.length / 2) {
    return {
      status: "pass",
      detail: `Topical structure looks clustered: ${entries.length} topic hubs, largest "${largest[0]}" with ${largest[1]} pages.`,
      fix: "No action needed — keep building out each hub with supporting cluster pages.",
    };
  }
  return {
    status: "warning",
    detail: `Weak pillar clustering: ${entries.length} hubs but largest "${largest[0]}" has only ${largest[1]} pages and ${thinHubs} thin hub(s). AI engines favor clear topical authority.`,
    fix: "Group related pages into pillar/cluster hubs (3+ pages per topic) and link them internally to build topical authority.",
  };
}

// For each non-pass issue, ask a cheap LLM for a copy-pasteable code/config
// snippet. Key-gated: silently skipped when OPENAI_API_KEY is absent, so the
// audit still works everywhere else. Never throws — degradation keeps the audit
// useful even if the LLM call fails.
async function attachFixSnippets(issues: AuditIssue[]): Promise<void> {
  const key = process.env.OPENAI_API_KEY;
  const toFix = issues.filter((i) => i.status !== "pass");
  if (!key || toFix.length === 0) return;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an SEO/GEO engineer. For each website audit issue, produce ONE concise, copy-pasteable code or config snippet the site owner can apply to fix it. Respond ONLY as JSON: {\"snippets\": { \"<check>\": \"<snippet>\" }}. Keep each snippet under 220 characters. No prose.",
          },
          {
            role: "user",
            content: JSON.stringify(toFix.map((i) => ({ check: i.check, detail: i.detail, fix: i.fix }))),
          },
        ],
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const snippets = (JSON.parse(data.choices[0].message.content).snippets ?? {}) as Record<string, string>;
    for (const issue of issues) {
      if (issue.status !== "pass" && snippets[issue.check]) {
        issue.fixSnippet = String(snippets[issue.check]);
      }
    }
  } catch {
    /* degrade silently — the human-written fix text still shows */
  }
}
