-- ============================================================
-- Migration 011 — Google Search Console Index Monitor (Batch 31)
--
-- The GSC OAuth refresh token is stored in the EXISTING `integrations`
-- table as provider = 'gsc' (encrypted via src/lib/crypto.ts, same shape
-- as the ga4/shopify rows: credentials = { data: encryptCredentials(...) }).
-- No change to that table's schema is needed.
--
-- This migration only adds the persisted index-status SNAPSHOT table used
-- to detect pages that NEWLY drop out of the index between monitor runs.
-- De-index detection requires comparing against a prior state, so we keep
-- the last-known coverage_state per URL per brand.
-- ============================================================

create table if not exists gsc_index_status (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  url text not null,
  coverage_state text,
  inspected_at timestamptz default now(),
  unique (brand_id, url)
);

alter table gsc_index_status enable row level security;

drop policy if exists "member can access own gsc_index_status" on gsc_index_status;
create policy "member can access own gsc_index_status" on gsc_index_status
  for all using (
    brand_id in (
      select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );
