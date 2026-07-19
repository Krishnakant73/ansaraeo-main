-- ============================================================
-- Migration 012 — Geo-metrics layer (visibility -> quality -> outcome)
--
-- Adds the intent taxonomy column, citation source-quality columns, the
-- recommendation-alignment column, and the persisted snapshot/event store that
-- backs trend velocity + anomaly detection on the dashboard and PDF report.
--
-- All derived metrics are computed ONLY from recorded visibility_runs /
-- citations — nothing is estimated (honesty design). Run after
-- migration_011_gsc_index.sql.
-- ============================================================

-- Prompt intent taxonomy (canonical keys live in src/lib/intent.ts).
alter table prompts add column if not exists intent text;

-- Citation source-quality proxy (deterministic, computed at insert time).
alter table citations add column if not exists source_quality numeric(5,2);
alter table citations add column if not exists is_trusted_source boolean default false;

-- Recommendation alignment, set by the extended visibility-engine classifier.
alter table visibility_runs add column if not exists recommendation_alignment text;

-- Persisted daily/weekly aggregates so trend velocity has a stable baseline.
create table if not exists geo_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  snapshot_date date not null,
  window_type text not null,
  metrics jsonb not null,
  per_engine jsonb,
  by_intent jsonb,
  computed_at timestamptz default now()
);

-- Deltas + anomalies between consecutive snapshots of the same window.
create table if not exists geo_metric_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  metric text not null,
  event_at timestamptz default now(),
  window_type text,
  delta numeric,
  direction text,
  anomaly boolean default false,
  detail jsonb
);

create index if not exists geo_metric_snapshots_brand_window_idx
  on geo_metric_snapshots (brand_id, window_type, snapshot_date desc);
create index if not exists geo_metric_events_brand_idx
  on geo_metric_events (brand_id, event_at desc);

-- RLS: org-scoped, mirroring the existing brands policy pattern.
alter table geo_metric_snapshots enable row level security;
alter table geo_metric_events enable row level security;

drop policy if exists "member can view own brand snapshots" on geo_metric_snapshots;
create policy "member can view own brand snapshots" on geo_metric_snapshots
  for select using (
    brand_id in (
      select id from brands
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );

drop policy if exists "member can view own brand events" on geo_metric_events;
create policy "member can view own brand events" on geo_metric_events
  for select using (
    brand_id in (
      select id from brands
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );
