// ============================================================
// Integration workspace loader + shape.
//
// Integrations live in migration_008 (revenue attribution). Each row
// is (brand_id, provider) unique; providers today are 'ga4', 'shopify',
// and 'gsc' (Google Search Console). credentials JSONB stores the
// encrypted secret via crypto.ts — this workspace NEVER decrypts. We
// surface which keys exist in the encrypted blob (structure only),
// not their values.
//
// getIntegrationById(id) — cookie-scoped, RLS-safe, null → 404.
// Embeds the parent brand so header can link out.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type IntegrationStats = {
  ageInDays: number;
  isEncrypted: boolean;                 // credentials.data present
  credentialKeyCount: number;           // shape hint only, never values
};

export type IntegrationBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
};

export type Integration = {
  id: string;
  brand_id: string;
  provider: string;                     // ga4|shopify|gsc
  status: string;                       // connected|error|revoked
  connected_at: string;
  // credentials is deliberately NOT typed with the raw shape — the
  // encrypted variant lives in `credentials.data` and we never expose
  // decrypted values to the workspace layer. We surface only shape.
  credentialShape: { keys: string[]; isEncrypted: boolean };
  brand: IntegrationBrand;
  stats: IntegrationStats;
};

const BRAND_COLUMNS = "id, name, slug, domain";

export async function getIntegrationById(id: string): Promise<Integration | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("integrations")
    .select("id, brand_id, provider, status, credentials, connected_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;

  const int = row as {
    id: string;
    brand_id: string;
    provider: string;
    status: string;
    credentials: unknown;
    connected_at: string;
  };

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", int.brand_id)
    .maybeSingle();
  if (!brand) return null;

  const shape = decodeCredentialShape(int.credentials);
  const stats: IntegrationStats = {
    ageInDays: Math.max(
      0,
      Math.floor((Date.now() - new Date(int.connected_at).getTime()) / 86_400_000),
    ),
    isEncrypted: shape.isEncrypted,
    credentialKeyCount: shape.keys.length,
  };

  return {
    id: int.id,
    brand_id: int.brand_id,
    provider: int.provider,
    status: int.status,
    connected_at: int.connected_at,
    credentialShape: shape,
    brand: brand as IntegrationBrand,
    stats,
  };
}

// Read shape ONLY — never values. When credentials look like the
// {data: "<encrypted>"} envelope, mark encrypted and don't try to read
// into the encrypted blob. When plaintext (legacy rows), report the
// top-level keys.
function decodeCredentialShape(
  credentials: unknown,
): { keys: string[]; isEncrypted: boolean } {
  if (!credentials || typeof credentials !== "object") {
    return { keys: [], isEncrypted: false };
  }
  const obj = credentials as Record<string, unknown>;
  if (typeof obj.data === "string") {
    // encrypted envelope
    return { keys: ["data"], isEncrypted: true };
  }
  return { keys: Object.keys(obj), isEncrypted: false };
}

export function providerLabel(provider: string): string {
  switch (provider) {
    case "ga4":
      return "Google Analytics 4";
    case "shopify":
      return "Shopify";
    case "gsc":
      return "Google Search Console";
    default:
      return provider;
  }
}

export function providerHelpUrl(provider: string, brandSlug: string): string {
  switch (provider) {
    case "ga4":
    case "shopify":
      return `/dashboard/b/${brandSlug}/settings/analytics`;
    case "gsc":
      return `/dashboard/b/${brandSlug}/gsc`;
    default:
      return `/dashboard/settings/integrations`;
  }
}

export function statusTone(status: string): "neutral" | "positive" | "negative" {
  if (status === "connected") return "positive";
  if (status === "error" || status === "revoked") return "negative";
  return "neutral";
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
