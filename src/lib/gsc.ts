// ============================================================
// Google Search Console Index Monitor (Batch 31)
//
// User-owned GSC integration:
//   - OAuth2 authorization-code flow (the user must connect the Google
//     account that OWNS the Search Console property). Refresh token is
//     stored encrypted in `integrations` (provider = 'gsc').
//   - URL Inspection API → per-URL index status, rich-results + mobile
//     usability signals.
//   - Indexing API → on-demand reindex (URL_UPDATED).
//   - Sitemaps list + Search Analytics (clicks/impressions/CTR/position).
//   - Persisted index-status snapshot (gsc_index_status) to flag pages
//     that NEWLY drop out of the index.
//
// Honesty design: we never auto-reindex (only on explicit user click),
// we cap inspections per run to respect the ~2000/day quota, and we only
// report de-index events against a real prior snapshot (never estimated).
//
// No googleapis SDK — raw fetch to Google's REST endpoints keeps the
// production build dependency-free and green.
// ============================================================

import { encryptCredentials, decryptCredentials } from "@/lib/crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeBrandedLift, type BrandedLift, type GscAgg, type BrandedLiftGroup } from "./gsc-branded-lift";

export type { BrandedLift, GscAgg, BrandedLiftGroup } from "./gsc-branded-lift";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/indexing",
];

export function gscRedirectUri(origin: string): string {
  return `${origin}/api/gsc/callback`;
}

export function buildGscAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: gscRedirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export function gscConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function postForm(url: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`Google token error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{ access_token: string; refresh_token: string }> {
  const data = await postForm(TOKEN_ENDPOINT, {
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (!data.refresh_token) throw new Error("No refresh_token returned — ensure prompt=consent and the property is owned by this account.");
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

export async function getAccessToken(refreshToken: string): Promise<string> {
  const data = await postForm(TOKEN_ENDPOINT, {
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return data.access_token;
}

function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

export type IndexInspection = {
  url: string;
  coverageState: string | null;
  indexed: boolean;
  pageFetchState: string | null;
  googleCanonical: string | null;
  roboted: boolean | null;
  lastCrawlTime: string | null;
  richResults: boolean;
  mobileUsable: boolean;
  sitemap: string | null;
  error?: string;
};

export async function inspectUrl(accessToken: string, siteUrl: string, inspectionUrl: string): Promise<IndexInspection> {
  const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify({ inspectionUrl, siteUrl, languageCode: "en-US" }),
  });
  if (!res.ok) {
    return { url: inspectionUrl, coverageState: null, indexed: false, pageFetchState: null, googleCanonical: null, roboted: null, lastCrawlTime: null, richResults: false, mobileUsable: false, sitemap: null, error: `Inspection failed: ${res.status}` };
  }
  const data = await res.json();
  const r = data?.inspectionResult?.indexStatusResult ?? {};
  const rich = data?.inspectionResult?.richResultsResult;
  const mobile = data?.inspectionResult?.mobileUsabilityResult;
  return {
    url: inspectionUrl,
    coverageState: r.coverageState ?? null,
    indexed: r.coverageState === "INDEXED",
    pageFetchState: r.pageFetchState ?? null,
    googleCanonical: r.googleCanonical ?? null,
    roboted: typeof r.roboted === "boolean" ? r.roboted : null,
    lastCrawlTime: r.lastCrawlTime ?? null,
    richResults: Boolean(rich?.verdict === "PASS" || (rich?.detectedItems ?? []).length > 0),
    mobileUsable: Boolean(mobile?.verdict === "PASS" || (mobile?.issue ?? []).length === 0),
    sitemap: r.sitemap ?? null,
  };
}

export async function requestIndexing(accessToken: string, url: string): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  if (!res.ok) return { ok: false, detail: `Indexing API error: ${res.status} ${await res.text()}` };
  return { ok: true, detail: "Reindex requested." };
}

export type GscSitemap = { path: string; lastSubmitted: string | null; isPending: boolean; errors: number; indexed: number | null };

export async function listSitemaps(accessToken: string, siteUrl: string): Promise<GscSitemap[]> {
  const res = await fetch(`https://searchconsole.googleapis.com/v1/sites/${encodeURIComponent(siteUrl)}/sitemaps`, {
    headers: authHeader(accessToken),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.sitemap ?? []).map((s: any) => ({
    path: s.path,
    lastSubmitted: s.lastSubmitted ?? null,
    isPending: Boolean(s.isPending),
    errors: s.errors ?? 0,
    indexed: s.contents?.[0]?.indexed ?? null,
  }));
}

export async function getSearchAnalytics(accessToken: string, siteUrl: string, days = 28): Promise<{ query: string; clicks: number; impressions: number; ctr: number; position: number }[]> {
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetch(`https://searchconsole.googleapis.com/v1/sites/${encodeURIComponent(siteUrl)}/searchanalytics/query`, {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify({
      startDate: iso(start),
      endDate: iso(end),
      dimensions: ["query"],
      rowLimit: 20,
      dataState: "final",
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.rows ?? []).map((row: any) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

// Range-bounded variant so we can compare two periods (baseline vs comparison).
export async function getSearchAnalyticsRange(
  accessToken: string,
  siteUrl: string,
  startDateISO: string,
  endDateISO: string,
  rowLimit = 100,
): Promise<{ query: string; clicks: number; impressions: number; ctr: number; position: number }[]> {
  const res = await fetch(`https://searchconsole.googleapis.com/v1/sites/${encodeURIComponent(siteUrl)}/searchanalytics/query`, {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify({
      startDate: startDateISO,
      endDate: endDateISO,
      dimensions: ["query"],
      rowLimit,
      dataState: "final",
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.rows ?? []).map((row: any) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

// ---- Branded-search lift (does AI visibility move demand?) ----
// Pure computation lives in ./gsc-branded-lift.ts (alias-free, unit-tested);
// here we just fetch the two periods and call it.

// Fetch baseline + comparison periods and compute the lift. `days` is the total
// span; the older half is baseline, the newer half is comparison.
export async function getBrandedLift(
  accessToken: string,
  siteUrl: string,
  brandName: string,
  days = 56,
): Promise<BrandedLift | null> {
  if (!brandName) return null;
  const half = Math.floor(days / 2);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date();
  const comparisonStart = new Date(Date.now() - half * 86400000);
  const baselineStart = new Date(Date.now() - days * 86400000);

  const [baselineRows, comparisonRows] = await Promise.all([
    getSearchAnalyticsRange(accessToken, siteUrl, iso(baselineStart), iso(comparisonStart)),
    getSearchAnalyticsRange(accessToken, siteUrl, iso(comparisonStart), iso(end)),
  ]);
  if (!baselineRows.length && !comparisonRows.length) return null;
  return computeBrandedLift(baselineRows, comparisonRows, brandName);
}


// ---- Integration storage (mirrors ga4/shopify rows) ----

export async function saveGscIntegration(supabase: SupabaseClient, brandId: string, creds: { refresh_token: string; email?: string }) {
  const encrypted = { data: encryptCredentials(creds) };
  await supabase
    .from("integrations")
    .upsert({ brand_id: brandId, provider: "gsc", credentials: encrypted, status: "connected" }, { onConflict: "brand_id,provider" });
}

export async function getGscRefreshToken(supabase: SupabaseClient, brandId: string): Promise<string | null> {
  const { data } = await supabase
    .from("integrations")
    .select("credentials")
    .eq("brand_id", brandId)
    .eq("provider", "gsc")
    .maybeSingle();
  if (!data) return null;
  try {
    const creds = decryptCredentials<{ refresh_token: string; email?: string }>(data.credentials.data);
    return creds.refresh_token;
  } catch {
    return null;
  }
}

// ---- Index-status snapshot (de-index detection) ----

export async function loadSnapshot(supabase: SupabaseClient, brandId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("gsc_index_status").select("url, coverage_state").eq("brand_id", brandId);
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.url, row.coverage_state);
  return map;
}

export async function saveSnapshot(supabase: SupabaseClient, brandId: string, rows: { url: string; coverageState: string | null }[]) {
  if (!rows.length) return;
  await supabase.from("gsc_index_status").upsert(
    rows.map((r) => ({ brand_id: brandId, url: r.url, coverage_state: r.coverageState, inspected_at: new Date().toISOString() })),
    { onConflict: "brand_id,url" }
  );
}

export function parseSitemapLocs(xml: string, limit: number): string[] {
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
  return locs.slice(0, limit);
}
