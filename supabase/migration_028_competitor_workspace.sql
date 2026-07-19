-- ============================================================
-- Migration 028 — Competitor workspace tables
--
-- Three additions:
--   1. competitor_traits — derived strengths/weaknesses cards.
--      Deterministic-first (see src/lib/competitor-traits.ts).
--      Rows are re-derived by the nightly cron; the table is a
--      cache of derived facts, not a source of truth.
--   2. opportunity_recommendations.competitor_id — pairs with the
--      prompt_id FK added in migration 027. Same nullable pattern:
--      most opportunities are brand-scoped, competitor attribution
--      is an enrichment.
--   3. competitor_snapshots — daily aggregate rollup that powers
--      the Timeline / Forecast tabs without recomputing per-load.
-- ============================================================

-- 1. Traits (Strengths / Weaknesses cards).
create table if not exists competitor_traits (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  dimension text not null check (dimension in ('strength', 'weakness')),
  label text not null,
  description text not null,
  evidence_run_ids uuid[] not null default '{}',
  evidence_count integer not null default 0,
  confidence numeric(4,3) not null default 0,
  beatable text check (beatable in ('easy','medium','hard') or beatable is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_competitor_traits_competitor
  on competitor_traits (competitor_id, dimension, confidence desc);

alter table competitor_traits enable row level security;

-- Traits inherit access from the parent competitor → brand.
create policy competitor_traits_read_by_org
  on competitor_traits for select
  using (
    exists (
      select 1
      from competitors c
      join brands b on b.id = c.brand_id
      join org_members om on om.org_id = b.org_id
      where c.id = competitor_traits.competitor_id
        and om.user_id = auth.uid()
    )
  );

-- Writes come from the service role (nightly cron / trait deriver).
-- No user-write policy — a denied write is the correct RLS default.

-- 2. Competitor attribution on opportunity recommendations.
alter table opportunity_recommendations
  add column if not exists competitor_id uuid references competitors(id) on delete set null;

create index if not exists idx_opportunity_recommendations_competitor
  on opportunity_recommendations (competitor_id, created_at desc)
  where competitor_id is not null;

-- 3. Daily snapshots. One row per (competitor, day).
create table if not exists competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  captured_on date not null,
  mention_rate numeric(5,2),        -- 0..100
  brand_mention_rate numeric(5,2),  -- your rate for the same window
  gap_pp numeric(5,2),              -- mention_rate - brand_mention_rate
  avg_position numeric(4,2),
  citation_count integer not null default 0,
  runs_observed integer not null default 0,
  created_at timestamptz not null default now(),
  unique (competitor_id, captured_on)
);

create index if not exists idx_competitor_snapshots_competitor_day
  on competitor_snapshots (competitor_id, captured_on desc);

alter table competitor_snapshots enable row level security;

create policy competitor_snapshots_read_by_org
  on competitor_snapshots for select
  using (
    exists (
      select 1
      from competitors c
      join brands b on b.id = c.brand_id
      join org_members om on om.org_id = b.org_id
      where c.id = competitor_snapshots.competitor_id
        and om.user_id = auth.uid()
    )
  );

comment on table competitor_traits is
  'Cache of derived strength/weakness cards for the competitor workspace. Re-derived nightly; RLS scopes reads by org.';
comment on table competitor_snapshots is
  'Daily rollup of competitor mention rate / gap / position for the Timeline + Forecast tabs. Written by the service role from visibility_runs; RLS scopes reads by org.';
