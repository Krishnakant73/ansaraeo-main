// ============================================================
// Resolves which brand is currently "selected" for the logged-in user.
//
// Multi-brand support (Batch 16): the user can manage multiple brands
// under one org. A cookie `selected_brand_id` remembers which brand
// they last switched to; if the cookie is missing or refers to a brand
// they no longer own, we fall back to the first brand in their org.
//
// Returns both the selected brand AND allBrands (for the BrandSwitcher
// dropdown in the sidebar layout).
// ============================================================

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Brand = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
};

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
      .select("id, name, domain, industry")
      .order("created_at", { ascending: true });

    const allBrands = (brands ?? []) as Brand[];
    return { brand: allBrands[0] ?? null, allBrands };
  }

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, domain, industry")
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
