// SupabaseAuthenticationService — the default adapter for AuthenticationService.
// Wraps the existing @supabase/ssr flow used by src/proxy.ts and every route
// today. Zero behavior change for existing callers.

import { createClient } from "@/lib/supabase/server";
import type {
  AuthenticationService,
  AuthSession,
  AuthUser,
  OrgMembership,
  Role,
} from "./types";

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export class SupabaseAuthenticationService implements AuthenticationService {
  async getCurrentUser(): Promise<AuthUser | null> {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      createdAt: data.user.created_at,
    };
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const supabase = await createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    return {
      user: {
        id: data.session.user.id,
        email: data.session.user.email ?? null,
        createdAt: data.session.user.created_at,
      },
      accessToken: data.session.access_token,
      expiresAt: data.session.expires_at ?? 0,
    };
  }

  async getMemberships(userId: string): Promise<OrgMembership[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", userId);
    return (data ?? []).map((r) => ({
      orgId: r.org_id as string,
      role: r.role as Role,
    }));
  }

  async hasRoleAtLeast(userId: string, orgId: string, minRole: Role): Promise<boolean> {
    const memberships = await this.getMemberships(userId);
    const membership = memberships.find((m) => m.orgId === orgId);
    if (!membership) return false;
    return ROLE_RANK[membership.role] >= ROLE_RANK[minRole];
  }

  async signOut(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
}

// Singleton — the default wiring. Compose in a future src/config/wiring.ts.
let _instance: SupabaseAuthenticationService | null = null;
export function getAuthService(): AuthenticationService {
  if (!_instance) _instance = new SupabaseAuthenticationService();
  return _instance;
}
