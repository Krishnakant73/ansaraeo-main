-- ============================================================
-- Migration 022 — Opportunity recommendations unique constraint
--
-- BUG: generateOpportunities() (src/lib/opportunity-engine.ts) does
--   supabase.from("opportunity_recommendations").upsert(rows, { onConflict: "brand_id,type" })
-- but the table created in migration_020 omitted the unique constraint, so
-- EVERY call threw:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- i.e. the entire opportunity engine was non-functional. This adds the
-- constraint the upsert clearly intends (one open recommendation per
-- brand + opportunity type).
-- ============================================================

alter table opportunity_recommendations
  add constraint opportunity_recommendations_brand_type_unique
  unique (brand_id, type);
