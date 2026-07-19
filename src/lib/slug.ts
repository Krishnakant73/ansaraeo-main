// ============================================================
// slugify — brand-name → URL segment.
//
// Matches the SQL backfill in migration_025_brand_slug.sql exactly:
//   • lowercase
//   • non-alphanumeric runs collapse to a single hyphen
//   • strip leading/trailing hyphens
//   • empty → "brand" (matches the SQL COALESCE branch)
//
// Used by the create-brand form and any future rename flow. Collision
// resolution (adding -2, -3, ...) is the caller's problem — the SQL
// migration handles it at insert time via the unique (org_id, slug)
// index, and app code should retry on constraint violation.
// ============================================================

export function slugify(input: string): string {
  const base = (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return base === "" ? "brand" : base;
}
