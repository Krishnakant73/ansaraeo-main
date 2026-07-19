-- ============================================================
-- Migration 025 — Brand slug (URL identity)
--
-- Phase 2 of the Mission Control IA redesign moves brand identity
-- into the URL: `/dashboard/b/[slug]/**`. Today, brand identity lives
-- in the `selected_brand_id` cookie — which means URLs are not
-- shareable, tab-able, or deep-linkable across brands. This adds a
-- `slug` column so every brand has a stable, human-readable URL segment.
--
-- Slugs are:
--   • lowercased, kebab-cased from `name`
--   • unique WITHIN an org (two orgs can each have a brand called "acme"
--     — the RLS boundary is org, not global, so this doesn't collide)
--   • non-null after backfill; enforced by NOT NULL + unique index
--
-- Backfill collision strategy: if two brands in the same org slug to
-- the same base string, later rows get `-2`, `-3`, ... suffixes.
-- Deterministic ordering by `id` so the same brand always wins the
-- unsuffixed slug across re-runs (the migration is idempotent-ish;
-- rerunning after the not-null constraint is already applied is a no-op).
-- ============================================================

alter table brands add column if not exists slug text;

with slugged as (
  select
    id,
    org_id,
    regexp_replace(
      regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ) as base
  from brands
  where slug is null
),
numbered as (
  select
    id,
    org_id,
    case
      when base = '' then 'brand'
      else base
    end as base,
    row_number() over (
      partition by org_id,
        case when base = '' then 'brand' else base end
      order by id
    ) as rn
  from slugged
)
update brands
  set slug = case when n.rn = 1 then n.base else n.base || '-' || n.rn::text end
  from numbered n
  where brands.id = n.id;

alter table brands alter column slug set not null;

create unique index if not exists brands_org_slug_idx on brands (org_id, slug);
