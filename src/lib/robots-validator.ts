// ============================================================
// Robots.txt AI-Crawler Validator (Batch 32 — product gap fix)
//
// A DETERMINISTIC, spec-accurate parser for robots.txt that evaluates
// whether each named AI answer-engine crawler (GPTBot, ClaudeBot,
// PerplexityBot, Google-Extended, …) is allowed to crawl the brand's
// key paths. This replaces the simplified regex check the Site Audit
// used, which (per CLAUDE.md) "may mis-parse complex wildcard/grouping
// rules."
//
// Honesty: no LLM, no network beyond fetching robots.txt, nothing
// persisted. Every verdict is a real parse of the actual robots.txt.
// Matching follows Google's robots.txt spec: per-bot most-specific
// group selection, `*`/`$` wildcards, and longest-matching-rule wins
// (Allow beats Disallow on a tie).
// ============================================================

const ROBOTS_TIMEOUT = 12000;

export const AI_CRAWLERS = [
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
] as const;

export type RobotsRule = { type: "allow" | "disallow"; value: string };
export type RobotsGroup = { userAgents: string[]; rules: RobotsRule[] };

export type BotRule = {
  bot: string;
  group: "specific" | "wildcard" | "none";
  matchedUserAgent: string | null;
  homepageAllowed: boolean;
  sitemapAllowed: boolean;
  blanketBlocked: boolean;
};

export type RobotsFinding = {
  pattern: string;
  severity: "high" | "medium" | "low" | "info";
  detail: string;
};

export type RobotsValidationResult = {
  url: string;
  ok: boolean;
  robotsUrl: string;
  fetched: boolean;
  groups: RobotsGroup[];
  sitemaps: string[];
  bots: BotRule[];
  findings: RobotsFinding[];
  notes: string[];
};

async function safeFetchRobots(robotsUrl: string): Promise<{ status: number | null; text: string | null }> {
  try {
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": "AnsarAEO-RobotsBot/1.0 (+https://ansaraeo.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT),
    });
    if (res.status === 404) return { status: 404, text: null };
    if (!res.ok) return { status: res.status, text: null };
    const t = await res.text();
    return { status: res.status, text: t };
  } catch {
    return { status: null, text: null };
  }
}

function parseRobots(text: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const hashIdx = line.indexOf("#");
    const clean = (hashIdx >= 0 ? line.slice(0, hashIdx) : line).trim();
    if (!clean) continue;

    const colon = clean.indexOf(":");
    if (colon < 0) continue;
    const field = clean.slice(0, colon).trim().toLowerCase();
    const value = clean.slice(colon + 1).trim();

    if (field === "user-agent") {
      // Consecutive User-agent lines belong to the SAME group. A new group
      // starts only when a User-agent follows a rule.
      if (!current || current.rules.length > 0) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.userAgents.push(value);
    } else if (field === "allow") {
      if (!current) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.rules.push({ type: "allow", value });
    } else if (field === "disallow") {
      if (!current) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.rules.push({ type: "disallow", value });
    } else if (field === "sitemap") {
      if (value) sitemaps.push(value);
    }
    // Other fields (Host, Crawl-delay, …) are ignored for AI-crawlability.
  }
  return { groups, sitemaps };
}

function escapeRegex(s: string): string {
  // Escape regex metacharacters but keep robots wildcards `*` and `$`.
  return s.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === "*" || c === "$" ? c : "\\" + c));
}

function patternToRegex(pattern: string): RegExp {
  const escaped = escapeRegex(pattern).replace(/\*/g, ".*");
  const anchored = "^" + escaped + (!pattern.endsWith("$") ? ".*" : "");
  return new RegExp(anchored, "i");
}

function ruleMatches(pattern: string, url: string): boolean {
  if (!pattern) return false; // empty value = no restriction
  try {
    return patternToRegex(pattern).test(url);
  } catch {
    return false;
  }
}

function selectGroup(
  bot: string,
  groups: RobotsGroup[]
): { group: RobotsGroup; kind: "specific" | "wildcard"; agent: string } | null {
  let best: { group: RobotsGroup; kind: "specific" | "wildcard"; agent: string; score: number } | null = null;
  for (const g of groups) {
    for (const ua of g.userAgents) {
      const lower = ua.toLowerCase();
      const botLower = bot.toLowerCase();
      let score = 0;
      if (lower === botLower) score = 3;
      else if (lower === "*") score = 1;
      else if (botLower.startsWith(lower)) score = 2;
      if (score > 0 && (!best || score > best.score)) {
        best = { group: g, kind: score === 1 ? "wildcard" : "specific", agent: ua, score };
      }
    }
  }
  return best ? { group: best.group, kind: best.kind, agent: best.agent } : null;
}

// Returns null when no group governs the bot (→ default allow).
function isPathAllowed(bot: string, path: string, groups: RobotsGroup[]): boolean | null {
  const sel = selectGroup(bot, groups);
  if (!sel) return null;
  let bestRule: { type: "allow" | "disallow"; len: number } | null = null;
  for (const r of sel.group.rules) {
    if (r.value === "") continue; // empty value = no restriction
    if (ruleMatches(r.value, path)) {
      const len = r.value.length;
      if (!bestRule || len > bestRule.len || (len === bestRule.len && r.type === "allow")) {
        bestRule = { type: r.type, len };
      }
    }
  }
  if (!bestRule) return true; // no matching rule → allowed
  return bestRule.type === "allow";
}

export async function analyzeRobots(params: { url: string }): Promise<RobotsValidationResult> {
  const base: RobotsValidationResult = {
    url: params.url,
    ok: false,
    robotsUrl: "",
    fetched: false,
    groups: [],
    sitemaps: [],
    bots: [],
    findings: [],
    notes: ["Robots verdicts are a deterministic parse of the live robots.txt — exact, not estimated."],
  };

  let input = params.url.trim();
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
  let origin: string;
  try {
    const u = new URL(input);
    origin = `${u.protocol}//${u.host}`;
  } catch {
    return { ...base, notes: [`Invalid URL: ${params.url}`] };
  }

  const robotsUrl = `${origin}/robots.txt`;
  const { status, text } = await safeFetchRobots(robotsUrl);

  if (text === null) {
    if (status === null) {
      return { ...base, robotsUrl, notes: [`Could not fetch ${robotsUrl} (timeout or network error).`] };
    }
    if (status === 404) {
      // No robots.txt → everything implicitly allowed.
      const bots: BotRule[] = AI_CRAWLERS.map((b) => ({
        bot: b,
        group: "none",
        matchedUserAgent: null,
        homepageAllowed: true,
        sitemapAllowed: true,
        blanketBlocked: false,
      }));
      return {
        ...base,
        ok: true,
        robotsUrl,
        fetched: false,
        bots,
        findings: [
          {
            pattern: "No robots.txt",
            severity: "info",
            detail: `No robots.txt at ${robotsUrl} (HTTP 404). All AI crawlers are implicitly allowed — good for discovery, though an explicit AI-welcome block is recommended.`,
          },
        ],
        notes: [
          ...base.notes,
          `No robots.txt found at ${robotsUrl} (HTTP 404). AI crawlers may read any page. Consider adding an explicit Allow block for GPTBot/ClaudeBot/PerplexityBot and a Sitemap directive.`,
        ],
      };
    }
    return { ...base, robotsUrl, notes: [`Fetch failed with HTTP ${status} for ${robotsUrl}.`] };
  }

  const { groups, sitemaps } = parseRobots(text);
  const findings: RobotsFinding[] = [];

  const bots: BotRule[] = AI_CRAWLERS.map((b) => {
    const sel = selectGroup(b, groups);
    const home = isPathAllowed(b, "/", groups);
    const sm = isPathAllowed(b, "/sitemap.xml", groups);
    const blocked = home === false;
    return {
      bot: b,
      group: sel ? sel.kind : "none",
      matchedUserAgent: sel ? sel.agent : null,
      homepageAllowed: home ?? true,
      sitemapAllowed: sm ?? true,
      blanketBlocked: blocked,
    };
  });

  const blocked = bots.filter((x) => x.blanketBlocked);
  if (blocked.length) {
    findings.push({
      pattern: "Blanket disallow affecting AI crawlers",
      severity: "high",
      detail: `${blocked.map((b) => b.bot).join(", ")} are disallowed from "/" — AI crawlers cannot read any page, so the brand will be absent from AI answers. Remove or scope the Disallow.`,
    });
  }
  if (!sitemaps.length) {
    findings.push({
      pattern: "No Sitemap directive",
      severity: "medium",
      detail: "No Sitemap: line in robots.txt. AI crawlers can't discover your content map; add Sitemap: https://…/sitemap.xml.",
    });
  }
  for (const b of bots) {
    if (b.group === "specific" && b.homepageAllowed === false) {
      findings.push({
        pattern: `Specific block for ${b.bot}`,
        severity: "high",
        detail: `A user-agent group for ${b.bot} disallows "/". This crawler is explicitly excluded from your site.`,
      });
    }
  }
  const hasSpecific = groups.some((g) => g.userAgents.some((ua) => ua.toLowerCase() !== "*"));
  if (!hasSpecific) {
    findings.push({
      pattern: "Only a wildcard (*) group",
      severity: "low",
      detail:
        "robots.txt defines rules only under User-agent: *. AI crawlers are governed by the same allow/disallow as all bots — which is fine, but explicit AI-bot groups let you fine-tune (e.g., allow GPTBot while limiting others).",
    });
  }

  return { ...base, ok: true, robotsUrl, fetched: true, groups, sitemaps, bots, findings, notes: base.notes };
}
