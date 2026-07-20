import { createClient } from "@/lib/supabase/server";
import type { Organization, OrgMember, OrganizationService } from "./types";

export class SupabaseOrganizationService implements OrganizationService {
  async getById(orgId: string): Promise<Organization | null> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("id, name, plan, billing_provider, billing_customer_id, created_at")
      .eq("id", orgId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      name: data.name as string,
      plan: data.plan as string,
      billingProvider: (data.billing_provider as string | null) ?? null,
      billingCustomerId: (data.billing_customer_id as string | null) ?? null,
      createdAt: data.created_at as string,
    };
  }

  async listForUser(userId: string): Promise<Organization[]> {
    const supabase = await createClient();
    // Reuses the existing RLS-scoped join through org_members.
    const { data } = await supabase
      .from("org_members")
      .select("organizations(id, name, plan, billing_provider, billing_customer_id, created_at)")
      .eq("user_id", userId);
    return (data ?? [])
      .map((r) => (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations))
      .filter(Boolean)
      .map((o) => ({
        id: o.id as string,
        name: o.name as string,
        plan: o.plan as string,
        billingProvider: (o.billing_provider as string | null) ?? null,
        billingCustomerId: (o.billing_customer_id as string | null) ?? null,
        createdAt: o.created_at as string,
      }));
  }

  async listMembers(orgId: string): Promise<OrgMember[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("org_members")
      .select("user_id, org_id, role, created_at")
      .eq("org_id", orgId);
    return (data ?? []).map((r) => ({
      userId: r.user_id as string,
      orgId: r.org_id as string,
      role: r.role as OrgMember["role"],
      createdAt: r.created_at as string,
    }));
  }

  async updateName(orgId: string, name: string): Promise<Organization> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organizations")
      .update({ name })
      .eq("id", orgId)
      .select("id, name, plan, billing_provider, billing_customer_id, created_at")
      .single();
    if (error || !data) throw new Error(`updateName failed: ${error?.message ?? "no data"}`);
    return {
      id: data.id as string,
      name: data.name as string,
      plan: data.plan as string,
      billingProvider: (data.billing_provider as string | null) ?? null,
      billingCustomerId: (data.billing_customer_id as string | null) ?? null,
      createdAt: data.created_at as string,
    };
  }
}

let _instance: SupabaseOrganizationService | null = null;
export function getOrganizationService(): OrganizationService {
  if (!_instance) _instance = new SupabaseOrganizationService();
  return _instance;
}
