// Brand service port. Brands are the workspace-scope aggregate in AnsarAEO —
// prompts, competitors, content, reports all descend from a brand.

export type Brand = {
  id: string;
  orgId: string;
  name: string;
  domain: string;
  slug: string | null;
  industry: string | null;
  createdAt: string;
};

export interface BrandService {
  getById(brandId: string): Promise<Brand | null>;
  getBySlug(orgId: string, slug: string): Promise<Brand | null>;
  listForOrg(orgId: string): Promise<Brand[]>;
  listForUser(userId: string): Promise<Brand[]>;
}
