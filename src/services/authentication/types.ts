// AuthenticationService port. Wraps Supabase Auth so callers depend on this
// interface, not on @supabase/ssr directly.
//
// Constitution: services are called by routes / actions / jobs. Never call
// routes from services. Routes get the port; adapters implement it.

export type AuthUser = {
  id: string;
  email: string | null;
  createdAt: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  expiresAt: number; // unix seconds
};

export type Role = "owner" | "admin" | "member" | "viewer";

export type OrgMembership = {
  orgId: string;
  role: Role;
};

export interface AuthenticationService {
  getCurrentUser(): Promise<AuthUser | null>;
  getCurrentSession(): Promise<AuthSession | null>;
  getMemberships(userId: string): Promise<OrgMembership[]>;
  hasRoleAtLeast(userId: string, orgId: string, minRole: Role): Promise<boolean>;
  signOut(): Promise<void>;
}
