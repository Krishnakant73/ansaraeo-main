// ============================================================
// Share (report link) workspace loader.
//
// `share_view_tokens` (migration_024) is the persistent artifact
// around every generated report — a signed URL with expiry + a
// revoke flag. Reports themselves are on-demand PDF buffers; the
// share row is what has a URL to open, an expiry to warn about,
// and a "revoke" action.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type ShareBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
};

export type ShareStats = {
  daysUntilExpiry: number | null;  // negative if past expiry
  isExpired: boolean;
  ageInDays: number | null;
};

export type ShareToken = {
  token: string;                    // uuid
  brand_id: string;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  revoked: boolean;
  brand: ShareBrand;
  stats: ShareStats;
};

const BRAND_COLUMNS = "id, name, slug, domain";

export async function getShareByToken(token: string): Promise<ShareToken | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("share_view_tokens")
    .select("token, brand_id, created_by, created_at, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!row) return null;
  const share = row as Omit<ShareToken, "brand" | "stats">;

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", share.brand_id)
    .maybeSingle();
  if (!brand) return null;

  const now = Date.now();
  const expiresMs = new Date(share.expires_at).getTime();
  const createdMs = new Date(share.created_at).getTime();
  const day = 86_400_000;
  const daysUntilExpiry = Math.round((expiresMs - now) / day);
  const isExpired = expiresMs < now;
  const ageInDays = Math.floor((now - createdMs) / day);

  return {
    ...share,
    brand: brand as ShareBrand,
    stats: { daysUntilExpiry, isExpired, ageInDays },
  };
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
