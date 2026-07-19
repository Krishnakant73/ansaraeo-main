// ============================================================
// llms.txt Validator (Batch 30)
//
// A DETERMINISTIC grammar check of an existing/generated llms.txt against the
// llmstxt.org spec — single H1 (site name), a blockquote summary, H2 link-list
// sections, no stray prose inside sections, no deep headings, fetchable links,
// and (when a live URL is supplied) the discovery headers agents look for.
//
// Like the GEO Linter, every verdict is a measurable text property — no LLM,
// no API key, no DB, fully reproducible.
// ============================================================

export type LlmTxtStatus = "pass" | "warning" | "fail";
export type LlmTxtIssue = { rule: string; status: LlmTxtStatus; detail: string; fix: string };
export type LlmTxtValidationResult = {
  source: { url?: string; mode: "text" | "url" };
  score: number; // 0-100
  status: LlmTxtStatus; // overall (worst of issues)
  h1: string | null;
  sectionCount: number;
  linkCount: number;
  optionalSectionPresent: boolean;
  issues: LlmTxtIssue[];
  notes: string[];
};

const STATUS_VALUE: Record<LlmTxtStatus, number> = { pass: 100, warning: 55, fail: 0 };

const LINK_RE = /^\s*[-*+]\s*\[([^\]]+)\]\(([^)]+)\)\s*$/;
const ABSOLUTE_URL_RE = /^https?:\/\//i;

function pushIssue(
  issues: LlmTxtIssue[],
  rule: string,
  status: LlmTxtStatus,
  detail: string,
  fix: string
) {
  issues.push({ rule, status, detail, fix });
}

async function maybeFetch(
  url: string | undefined
): Promise<{ text: string | null; headers: Record<string, string> }> {
  if (!url) return { text: null, headers: {} };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AnsarAEO-llmstxt-validator/1.0 (+https://ansaraeo.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const text = res.ok ? await res.text() : null;
    return { text, headers };
  } catch {
    return { text: null, headers: {} };
  }
}

export async function validateLlmsTxt(params: {
  text?: string;
  url?: string;
}): Promise<LlmTxtValidationResult> {
  const issues: LlmTxtIssue[] = [];
  const notes: string[] = [];
  let mode: "text" | "url" = "text";
  let raw = params.text ?? "";

  if (params.url && !params.text) {
    mode = "url";
    const { text, headers } = await maybeFetch(params.url);
    if (text === null) {
      notes.push(
        `Could not fetch ${params.url} — validate by pasting the file contents directly, or check the URL is live.`
      );
    } else {
      raw = text;
      // Discovery-header checks (only possible when we fetched a live URL).
      const linkHeader = headers["link"];
      if (linkHeader && /rel=["']?llms\.txt/i.test(linkHeader)) {
        pushIssue(issues, "discovery-header", "pass", 'A Link header references llms.txt (rel="llms.txt").', "");
      } else {
        pushIssue(
          issues,
          "discovery-header",
          "warning",
          'No <link rel="llms.txt"> header found on the URL.',
          'Add a response header: Link: <https://yourdomain.com/llms.txt>; rel="llms.txt"'
        );
      }
      if (headers["x-llms-txt"]) {
        pushIssue(issues, "discovery-header-x", "pass", "X-Llms-Txt header present.", "");
      } else {
        pushIssue(
          issues,
          "discovery-header-x",
          "warning",
          "No X-Llms-Txt header found.",
          "Optionally add: X-Llms-Txt: https://yourdomain.com/llms.txt"
        );
      }
    }
  }

  const lines = raw.split(/\r?\n/);
  let h1: string | null = null;
  let h1Count = 0;
  let sectionCount = 0;
  let linkCount = 0;
  let optionalSectionPresent = false;
  let inFence = false;
  let currentSection: string | null = null;
  let currentSectionOptional = false;
  let sawSummary = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (/^#\s+/.test(line)) {
      h1Count++;
      if (h1Count === 1) h1 = line.replace(/^#\s+/, "").trim();
      continue;
    }
    if (/^#{3,6}\s+/.test(line)) {
      pushIssue(
        issues,
        "no-deep-headings",
        "warning",
        `Deep heading found: "${line.trim()}". llmstxt.org allows only one H1 and H2 link-list sections.`,
        "Demote to an H2 section, or fold the content into the nearest H2 section's link list."
      );
      continue;
    }
    if (/^##\s+/.test(line)) {
      currentSection = line.replace(/^##\s+/, "").trim();
      currentSectionOptional = /optional/i.test(currentSection);
      if (currentSectionOptional) optionalSectionPresent = true;
      sectionCount++;
      continue;
    }
    if (/^>\s+/.test(line)) {
      if (h1Count === 1 && currentSection === null) sawSummary = true;
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const m = line.match(LINK_RE);
      if (m) {
        linkCount++;
        const href = m[2].trim();
        if (!ABSOLUTE_URL_RE.test(href)) {
          pushIssue(
            issues,
            "fetchable-links",
            "warning",
            `Link "${m[1]}" uses a non-absolute URL (${href}). AI crawlers prefer absolute URLs.`,
            "Use an absolute https:// URL."
          );
        } else if (/^(mailto:|tel:)/i.test(href)) {
          pushIssue(
            issues,
            "fetchable-links",
            "fail",
            `Link "${m[1]}" is a ${href.split(":")[0]} link, not a web page.`,
            "Link to a real web page instead."
          );
        }
      } else if (currentSection && !currentSectionOptional) {
        pushIssue(
          issues,
          "link-list-items",
          "warning",
          `List item in "${currentSection}" is not a [name](url) link: "${line.trim()}". H2 sections should be link lists.`,
          "Format as [Page name](https://absolute-url)."
        );
      } else if (currentSection && currentSectionOptional) {
        // Optional section allows freeform prose, but still count real links.
        if (m) linkCount++;
      }
      continue;
    }
    const trimmed = line.trim();
    if (trimmed && currentSection && !currentSectionOptional) {
      pushIssue(
        issues,
        "no-prose-in-sections",
        "warning",
        `Stray prose inside H2 section "${currentSection}": "${trimmed.slice(0, 80)}". H2 sections should contain only link lists.`,
        "Move prose into the blockquote summary (under H1) or into the Optional section."
      );
    }
  }

  // H1 checks
  if (h1Count === 0) {
    pushIssue(issues, "single-h1", "fail", "No H1 found. llms.txt must start with a single H1 (the site name).", "Add a line: # Your Site Name");
  } else if (h1Count > 1) {
    pushIssue(
      issues,
      "single-h1",
      "fail",
      `Found ${h1Count} H1 headings. Only one H1 is allowed.`,
      "Keep a single H1 as the site name; convert the rest to H2 sections."
    );
  } else {
    pushIssue(issues, "single-h1", "pass", `Single H1 present: "${h1}".`, "");
  }

  if (h1 && !sawSummary) {
    pushIssue(
      issues,
      "summary-blockquote",
      "warning",
      "No blockquote summary immediately after the H1. llms.txt should include a short > summary line.",
      "Add a blockquote right under the H1: > One-line description of your site."
    );
  } else if (h1) {
    pushIssue(issues, "summary-blockquote", "pass", "Blockquote summary present under the H1.", "");
  }

  if (sectionCount === 0) {
    pushIssue(
      issues,
      "h2-sections",
      "warning",
      'No H2 sections. Add at least a "Key pages" or "Optional" section listing links.',
      "Add: ## Key pages followed by - [Page](https://url) items."
    );
  } else {
    pushIssue(issues, "h2-sections", "pass", `${sectionCount} H2 section(s) present.`, "");
  }

  if (linkCount === 0) {
    pushIssue(
      issues,
      "link-list-items",
      "warning",
      "No [name](url) links found. llms.txt sections are meant to be link lists.",
      "Add list items formatted as [Page name](https://absolute-url)."
    );
  }

  const score = issues.length
    ? Math.round(issues.reduce((s, i) => s + STATUS_VALUE[i.status], 0) / issues.length)
    : 100;
  const hasFail = issues.some((i) => i.status === "fail");
  const hasWarn = issues.some((i) => i.status === "warning");
  const status: LlmTxtStatus = hasFail ? "fail" : hasWarn ? "warning" : "pass";

  return {
    source: { url: params.url, mode },
    score,
    status,
    h1,
    sectionCount,
    linkCount,
    optionalSectionPresent,
    issues,
    notes,
  };
}
