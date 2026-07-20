import { createClient } from "@/lib/supabase/server";
import type { Brand, BrandService } from "./types";

type BrandRow = {
  id: string;
  org_id: string;
  name: string;
  domain: string;
  slug: string | null;
  industry: string | null;
  created_at: string;
};

function mapBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    domain: row.domain,
    slug: row.slug,
    industry: row.industry,
    createdAt: row.created_at,
  };
}

export class SupabaseBrandService implements BrandService {
  async getById(brandId: string): Promise<Brand | null> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("brands")
      .select("id, org_id, name, domain, slug, industry, created_at")
      .eq("id", brandId)
      .maybeSingle();
    return data ? mapBrand(data as BrandRow) : null;
  }

  async getBySlug(orgId: string, slug: string): Promise<Brand | null> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("brands")
      .select("id, org_id, name, domain, slug, industry, created_at")
      .eq("org_id", orgId)
      .eq("slug", slug)
      .maybeSingle();
    return data ? mapBrand(data as BrandRow) : null;
  }

  async listForOrg(orgId: string): Promise<Brand[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("brands")
      .select("id, org_id, name, domain, slug, industry, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => mapBrand(r as BrandRow));
  }

  async listForUser(userId: string): Promise<Brand[]> {
    // Reuses the existing org_members → brands RLS join. The cookie client's
    // RLS filter means we only need to scope by user's memberships implicitly.
    const supabase = await createClient();
    void userId;
    const { data } = await supabase
      .from("brands")
      .select("id, org_id, name, domain, slug, industry, created_at")
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => mapBrand(r as BrandRow));
  }
}

let _instance: SupabaseBrandService | null = null;
export function getBrandService(): BrandService {
  if (!_instance) _instance = new SupabaseBrandService();
  return _instance;
}
