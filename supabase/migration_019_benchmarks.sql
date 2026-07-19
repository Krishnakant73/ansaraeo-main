-- ============================================================
-- Migration 019 — AI Industry Benchmark Platform (Foundation MVP)
--
-- Adds an ANONYMOUS, aggregate benchmark warehouse that turns every
-- visibility_run into industry-wide intelligence. Two layers:
--
--   1. benchmark_brand_snapshots — ATTRIBUTED (has brand_id), RLS org-scoped.
--      Per-brand rolled-up metrics per period, broken down by engine / intent /
--      language so the aggregate layer can group brands along any dimension.
--      Also feeds the brand's own "Your Position" view.
--
--   2. benchmark_aggregates — ANONYMOUS (NO brand_id). Cross-brand cells with
--      brand_count + avg + percentiles. A cell is only `published = true`
--      when it aggregates >= 5 distinct brands (k-anonymity, see
--      src/lib/benchmark-privacy.ts). Sub-threshold cells are stored but
--      gated off so the API can honestly say "not enough data yet".
--
-- All brand-column ALTERs are nullable + non-breaking. The warehouse stores
-- NO raw brand name / domain / prompt text / run content — only normalized
-- dimensions + derived metrics. Privacy-by-construction.
-- ============================================================

-- ---------- additive brand enrichment + opt-in flags ----------
alter table brands add column if not exists company_size text;
alter table brands add column if not exists traffic_band text;
alter table brands add column if not exists revenue_band text;
alter table brands add column if not exists industry_category text; -- normalized cache of `industry`
alter table brands add column if not exists benchmark_opt_in boolean not null default true;
alter table brands add column if not exists benchmark_public_opt_in boolean not null default false;

-- ---------- benchmark_brand_snapshots (attributed) ----------
create table if not exists benchmark_brand_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  period_start date not null,
  period_type text not null default 'month',
  -- dimension axes: '*' sentinel means "across all" of that axis
  engine text not null default '*',
  intent text not null default '*',
  language text not null default '*',
  -- brand dimension attributes captured at compute time
  industry_category text not null default 'other',
  region text not null default 'global',
  country text,
  company_size text,
  traffic_band text,
  revenue_band text,
  -- derived metrics (0..1 except position/2 counts)
  mention_rate numeric(6,5),
  citation_rate numeric(6,5),
  avg_position numeric(6,2),
  avg_trust numeric(6,5),
  avg_visibility numeric(6,5),
  run_count int not null default 0,
  prompt_count int not null default 0,
  computed_at timestamptz default now(),
  unique (brand_id, period_start, period_type, engine, intent, language)
);

-- ---------- benchmark_aggregates (anonymous) ----------
create table if not exists benchmark_aggregates (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_type text not null default 'month',
  dimension_type text not null,   -- overall|industry|region|country|language|engine|intent|company_size|traffic_band|revenue_band
  dimension_value text not null,  -- canonical key (or 'all' for overall)
  engine text,                    -- optional engine scope (cross-cut), null = across engines
  metric text not null,           -- mention_rate|citation_rate|avg_position|avg_trust|avg_visibility
  brand_count int not null default 0,
  avg numeric(8,5),
  p10 numeric(8,5),
  p25 numeric(8,5),
  p50 numeric(8,5),
  p75 numeric(8,5),
  p90 numeric(8,5),
  min numeric(8,5),
  max numeric(8,5),
  stddev numeric(8,5),
  total_observations int not null default 0,
  published boolean not null default false,
  computed_at timestamptz default now(),
  unique (period_start, period_type, dimension_type, dimension_value, engine, metric)
);

-- ---------- indexes for dashboard read paths ----------
create index if not exists idx_bsnap_brand_period on benchmark_brand_snapshots (brand_id, period_start desc);
create index if not exists idx_bsnap_period_overall on benchmark_brand_snapshots (period_start, engine, intent, language);
create index if not exists idx_bagg_lookup on benchmark_aggregates (dimension_type, dimension_value, period_start desc);
create index if not exists idx_bagg_engine on benchmark_aggregates (dimension_type, engine, period_start desc);

-- ---------- RLS ----------
alter table benchmark_brand_snapshots enable row level security;
alter table benchmark_aggregates enable row level security;

-- Attributed snapshots: only the owning org may touch them.
drop policy if exists "member can access own benchmark snapshots" on benchmark_brand_snapshots;
create policy "member can access own benchmark snapshots" on benchmark_brand_snapshots
  for all using (brand_id in (
    select id from brands where org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  ));

-- Anonymous aggregates: authenticated users may READ only published cells.
drop policy if exists "authenticated can read published benchmarks" on benchmark_aggregates;
create policy "authenticated can read published benchmarks" on benchmark_aggregates
  for select using (published = true and auth.uid() is not null);
