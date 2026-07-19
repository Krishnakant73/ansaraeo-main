-- ============================================================
-- Migration 014 — Real domain authority (DataForSEO enrichment)
--
-- Replaces the "true DA" gap (PRD §7.7 / §11-G). DataForSEO's Backlinks API
-- returns a real `domain_rank` (0–100) computed from its backlink index — a
-- credible, externally-computed authority signal that complements (does NOT
-- replace) the deterministic `source_quality` proxy.
--
-- Design (honesty + cost):
--   * `domain_authority` caches the lookup per normalized domain, refreshed
--     incrementally (bounded batch) by the nightly enrichment cron — never one
--     live call per citation insert (DataForSEO bills per request).
--   * `citations.authority_score` / `authority_source` carry the cached value
--     when available; both stay NULL when creds are absent or not yet fetched,
--     so the deterministic `source_quality` proxy remains the honest default.
--   * `authority_source` is always labeled (e.g. 'dataforseo_domain_rank') so
--     the UI never implies this is Google's own DA.
--
-- Run after migration_013_priority_alerts.sql.
-- ============================================================

-- Cached authority per domain (one row per normalized domain).
create table if not exists domain_authority (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  authority_score numeric(5,2),     -- DataForSEO domain_rank, 0–100
  referring_domains integer,
  backlinks integer,
  source text not null default 'dataforseo_domain_rank',
  fetched_at timestamptz default now()
);

create index if not exists domain_authority_domain_idx on domain_authority (domain);

-- Carry the cached real authority onto each citation (nullable; null = no feed yet).
alter table citations add column if not exists authority_score numeric(5,2);
alter table citations add column if not exists authority_source text;

-- RLS: domain_authority is global reference data but scoped read to org members
-- (citations that reference it are already org-scoped). Mirror the pattern.
alter table domain_authority enable row level security;

drop policy if exists "members can read domain authority" on domain_authority;
create policy "members can read domain authority" on domain_authority
  for select using (
    exists (
      select 1 from brands
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );
