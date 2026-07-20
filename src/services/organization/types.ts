// Organization service port. Wraps the `organizations` + `org_members` tables.
// The pre-existing signup trigger (handle_new_user) already creates an org
// on signup — this service is for read + membership management, not creation.

export type Organization = {
  id: string;
  name: string;
  plan: string;
  billingProvider: string | null;
  billingCustomerId: string | null;
  createdAt: string;
};

export type OrgMember = {
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: string;
};

export interface OrganizationService {
  getById(orgId: string): Promise<Organization | null>;
  listForUser(userId: string): Promise<Organization[]>;
  listMembers(orgId: string): Promise<OrgMember[]>;
  updateName(orgId: string, name: string): Promise<Organization>;
}
