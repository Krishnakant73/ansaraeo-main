-- ============================================================
-- Migration 004 — Site Audit
-- Run after migration_003_agent.sql. Only adds a new table.
-- ============================================================

create table site_audits (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  run_at timestamptz default now(),
  overall_score int,
  schema_markup_score int,
  crawlability_score int,
  llms_txt_present boolean,
  issues jsonb  -- structured list: [{ check, status, detail, fix }]
);

alter table site_audits enable row level security;

create policy "member can access own site_audits" on site_audits
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));
