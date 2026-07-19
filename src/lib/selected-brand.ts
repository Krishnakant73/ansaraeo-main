// ============================================================
// Resolves which brand is currently "selected" for the logged-in user.
//
// Two entry points:
//
//   1. getSelectedBrand()  — legacy cookie-based (still used by 33
//      unmigrated pages and every /api/** route). Reads
//      `selected_brand_id` cookie, falls back to first brand in org.
//
//   2. getBrandFromSlug(slug) — Phase 2 URL-based (used by pages
//      under /dashboard/b/[slug]/**). Reads brand by slug via the
//      cookie client, so RLS filters unauthorized access. Returns
//      null on miss — caller should call notFound().
//
// Both go through the cookie client (RLS-scoped). Never use the
// service client here or brand existence would leak across orgs.
// ============================================================

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string | null;
};

const BRAND_COLUMNS = "id, name, slug, domain, industry";

export async function getSelectedBrand(): Promise<{
  brand: Brand | null;
  allBrands: Brand[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { brand: null, allBrands: [] };

  // Get the user's org, then all brands in that org
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    // User has no org — try getting brands directly (legacy/simple path)
    const { data: brands } = await supabase
      .from("brands")
      .select(BRAND_COLUMNS)
      .order("created_at", { ascending: true });

    const allBrands = (brands ?? []) as Brand[];
    return { brand: allBrands[0] ?? null, allBrands };
  }

  const { data: brands } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("org_id", membership.org_id)
    .order("created_at", { ascending: true });

  const allBrands = (brands ?? []) as Brand[];
  if (allBrands.length === 0) return { brand: null, allBrands: [] };

  // Check for a saved selection in cookies
  const cookieStore = await cookies();
  const savedId = cookieStore.get("selected_brand_id")?.value;

  if (savedId) {
    const match = allBrands.find((b) => b.id === savedId);
    if (match) return { brand: match, allBrands };
  }

  // Fallback to first brand
  return { brand: allBrands[0], allBrands };
}

// ------------------------------------------------------------
// Phase 2: URL-driven brand resolution.
//
// Called from pages under /dashboard/b/[slug]/**. Reads via the
// cookie client so RLS enforces org membership — a user hitting
// another org's slug gets `null` here, and the layout should call
// notFound() to render the standard 404 (not a "brand not found"
// message that would leak existence).
// ------------------------------------------------------------
export async function getBrandFromSlug(slug: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  return (data as Brand | null) ?? null;
}
