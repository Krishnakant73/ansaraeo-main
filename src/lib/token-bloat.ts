// ============================================================
// Token Bloat / AI-Crawler Efficiency Checker (Batch 31)
//
// Estimates how many tokens an AI crawler (GPTBot / ClaudeBot /
// PerplexityBot) burns consuming a single page, and pinpoints the
// bloat that gets a page dropped from AI recommendations. This is a
// DETERMINISTIC, rule-based measurement — no LLM, no API key, no
// network calls beyond fetching the page itself, nothing persisted.
//
// Honesty note: token counts are an APPROXIMATION (~4 chars/token for
// English). We label them as estimates everywhere they are shown. The
// *ratios* and *flags* (which patterns dominate the page) are exact,
// so the optimization guidance is sound even if the absolute number
// is ±20%. This is the same "real measurement, not estimation of
// outcomes" principle as the GEO Linter.
//
// Scope guards: non-HTML responses (PDF/JSON/image/plain-text) are rejected
// with an explicit note, and JS-rendered SPA shells are flagged so the
// "low content" finding isn't mistaken for a real problem.
// ============================================================

import * as cheerio from "cheerio";

const PAGE_TIMEOUT = 12000;

export type BloatFlag = {
  pattern: string;
  severity: "high" | "medium" | "low";
  detail: string;
};

export type TokenBloatResult = {
  url: string;
  ok: boolean;
  htmlBytes: number;
  estTotalTokens: number;
  estContentTokens: number;
  estScriptTokens: number;
  estStyleTokens: number;
  estMarkupTokens: number;
  contentRatio: number;
  scriptRatio: number;
  styleRatio: number;
  markupRatio: number;
  dataAttrCount: number;
  classCount: number;
  hasJsonLd: boolean;
  efficiencyScore: number; // 0-100: share of tokens that are citable content
  flags: BloatFlag[];
  notes: string[];
};

function estTokens(chars: number): number {
  // Rough, honest approximation for English web text.
  return Math.max(0, Math.round(chars / 4));
}

async function safeFetch(url: string): Promise<{ status: number | null; html: string | null; contentType: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AnsarAEO-TokenBloatBot/1.0 (+https://ansaraeo.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT),
    });
    if (!res.ok) return { status: res.status, html: null, contentType: res.headers.get("content-type") };
    const html = await res.text();
    return { status: res.status, html, contentType: res.headers.get("content-type") };
  } catch {
    return { status: null, html: null, contentType: null };
  }
}

// Detect a client-side-rendered SPA shell: JS-app hydration markers present
// but the server HTML carries almost no real text. Cheerio can't run JS, so
// such a page would otherwise be mis-flagged as "low content".
function looksLikeSpaShell(html: string, textChars: number): boolean {
  if (textChars >= 300) return false;
  const markers = [
    "__NEXT_DATA__",
    "data-reactroot",
    "window.__INITIAL_STATE__",
    "__NUXT__",
    "ng-version",
    'id="root"',
    'id="app"',
    "data-server-rendered",
  ];
  return markers.some((m) => html.includes(m));
}

export async function analyzeTokenBloat(params: { url: string }): Promise<TokenBloatResult> {
  const base: TokenBloatResult = {
    url: params.url,
    ok: false,
    htmlBytes: 0,
    estTotalTokens: 0,
    estContentTokens: 0,
    estScriptTokens: 0,
    estStyleTokens: 0,
    estMarkupTokens: 0,
    contentRatio: 0,
    scriptRatio: 0,
    styleRatio: 0,
    markupRatio: 0,
    dataAttrCount: 0,
    classCount: 0,
    hasJsonLd: false,
    efficiencyScore: 0,
    flags: [],
    notes: [
      "Token estimates use ~4 chars/token (English) — an approximation, shown as estimates. Ratios and flags are exact measurements of the fetched HTML.",
    ],
  };

  const { status, html, contentType } = await safeFetch(params.url);
  if (!html) {
    return {
      ...base,
      notes: [
        status === null
          ? `Could not fetch ${params.url} (timeout or network error).`
          : `Fetch failed with HTTP ${status} for ${params.url}.`,
      ],
    };
  }

  // Guard: only HTML webpages are in scope. A PDF/JSON/image/plain-text
  // response would produce meaningless character counts, so say so instead
  // of returning garbage measurements.
  if (contentType && !contentType.toLowerCase().includes("text/html")) {
    return {
      ...base,
      notes: [
        `Response for ${params.url} is not an HTML page (Content-Type: ${contentType}). The Token Bloat Checker only measures HTML webpages — PDFs, JSON APIs, images, and plain-text files are out of scope.`,
      ],
    };
  }

  const $ = cheerio.load(html);

  let scriptChars = 0;
  $("script").each((_, el) => {
    const src = (el as any).attribs?.src;
    if (!src) scriptChars += ($(el).text() ?? "").length; // inline only
  });

  let styleChars = 0;
  $("style").each((_, el) => {
    styleChars += ($(el).text() ?? "").length;
  });

  const textChars = ($("body").text() || $.root().text() || "").length;
  const spaShell = looksLikeSpaShell(html, textChars);
  const totalChars = html.length;
  const markupChars = Math.max(0, totalChars - scriptChars - styleChars - textChars);

  let dataAttrCount = 0;
  const classSet = new Set<string>();
  $("*").each((_, el) => {
    const attrs = (el as any).attribs;
    if (!attrs) return;
    for (const k in attrs) {
      if (k.startsWith("data-")) dataAttrCount++;
    }
    const cls = attrs.class;
    if (cls && typeof cls === "string") {
      for (const c of cls.split(/\s+/)) if (c) classSet.add(c);
    }
  });

  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;

  const estTotal = estTokens(totalChars);
  const estContent = estTokens(textChars);
  const estScript = estTokens(scriptChars);
  const estStyle = estTokens(styleChars);
  const estMarkup = estTokens(markupChars);

  const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);
  const contentRatio = safeDiv(estContent, estTotal);
  const scriptRatio = safeDiv(estScript, estTotal);
  const styleRatio = safeDiv(estStyle, estTotal);
  const markupRatio = safeDiv(estMarkup, estTotal);

  const flags: BloatFlag[] = [];

  if (estTotal > 40000) {
    flags.push({
      pattern: "Very large page",
      severity: "high",
      detail: `Page is ~${estTotal.toLocaleString()} tokens. AI crawlers have finite context windows; very large pages are more likely to be truncated or skipped.`,
    });
  }
  if (contentRatio < 0.3) {
    const spaCaveat = spaShell
      ? " This page also contains JS-app hydration markers — if its content is rendered client-side, a real AI crawler may only receive this shell. Measure the pre-rendered/SSR HTML for an accurate read."
      : "";
    flags.push({
      pattern: "Low content-to-boilerplate ratio",
      severity: "high",
      detail: `Only ${(contentRatio * 100).toFixed(0)}% of tokens are citable content; the rest is markup/scripts/styles. AI crawlers spend most of their budget on non-citable text.${spaCaveat}`,
    });
  }
  if (scriptRatio > 0.25) {
    flags.push({
      pattern: "Excessive inline scripts",
      severity: "high",
      detail: `Inline <script> is ~${(scriptRatio * 100).toFixed(0)}% of tokens (${
        estScript.toLocaleString()
      }). Move JS to external files or defer it so crawlers meet content sooner.`,
    });
  } else if (scriptRatio > 0.15) {
    flags.push({
      pattern: "Heavy inline scripts",
      severity: "medium",
      detail: `Inline <script> is ~${(scriptRatio * 100).toFixed(0)}% of tokens. Consider externalizing or deferring.`,
    });
  }
  if (styleRatio > 0.2) {
    flags.push({
      pattern: "Bloated inline CSS",
      severity: "medium",
      detail: `Inline <style> is ~${(styleRatio * 100).toFixed(0)}% of tokens (${
        estStyle.toLocaleString()
      }). Move CSS to external stylesheets.`,
    });
  }
  if (dataAttrCount > 100) {
    flags.push({
      pattern: "Framework artifacts (data-* attributes)",
      severity: "medium",
      detail: `${dataAttrCount} data-* attributes (hydration state, component props). Common with React/Next; they add token cost with no citable value.`,
    });
  }
  if (classSet.size > 300) {
    flags.push({
      pattern: "Utility-CSS class bloat",
      severity: "low",
      detail: `${classSet.size} distinct CSS classes — typical of utility frameworks (Tailwind). Each class token is overhead for AI crawlers.`,
    });
  }
  if (!hasJsonLd) {
    flags.push({
      pattern: "Missing structured data (JSON-LD)",
      severity: "medium",
      detail: "No <script type=\"application/ld+json\"> found. AI crawlers prefer explicit structured data (Product/Organization/FAQPage) over inferred meaning.",
    });
  }

  const efficiencyScore = Math.round(Math.min(1, Math.max(0, contentRatio)) * 100);

  const finalNotes = [...base.notes];
  if (spaShell) {
    finalNotes.push(
      "Content appears JS-rendered (SPA shell detected): measurements reflect the server-returned HTML only. If the real content is injected by JavaScript at runtime, the low content-to-boilerplate finding above may not reflect the rendered page — test the pre-rendered/SSR HTML for an accurate read."
    );
  }

  return {
    ...base,
    ok: true,
    htmlBytes: Buffer.byteLength(html),
    estTotalTokens: estTotal,
    estContentTokens: estContent,
    estScriptTokens: estScript,
    estStyleTokens: estStyle,
    estMarkupTokens: estMarkup,
    contentRatio,
    scriptRatio,
    styleRatio,
    markupRatio,
    dataAttrCount,
    classCount: classSet.size,
    hasJsonLd,
    efficiencyScore,
    flags,
    notes: finalNotes,
  };
}
