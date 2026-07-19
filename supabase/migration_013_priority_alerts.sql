-- ============================================================
-- Migration 013 — Priority prompts (shortlist share) + alerting
--
-- 1. prompts.priority boolean — flags the brand's "money prompts" so the
--    dashboard can report shortlist share (visibility/citation on the highest-
--    value prompts only), distinct from overall coverage.
-- 2. geo_alert_rules — user-defined threshold alerts (citation drop, rank
--    worsen, competitor spike, anomaly). Evaluated nightly by the metrics-
--    snapshot cron against the persisted geo_metric_snapshots.
-- 3. geo_alert_firings — every time a rule is breached, a firing is recorded
--    (deduped per rule per window so a sustained breach doesn't spam).
--
-- Run after migration_012_geo_metrics.sql.
-- ============================================================

-- 1. Priority prompts (shortlist share)
alter table prompts add column if not exists priority boolean default false;
create index if not exists prompts_priority_idx on prompts (brand_id, priority)
  where priority = true;

-- 2. Alert rules
create table if not exists geo_alert_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  metric text not null,                 -- visibility_rate | citation_rate | citation_share | avg_rank | model_divergence | recommendation_quality
  window_type text not null default '7d',    -- '7d' | '30d'
  direction text not null,              -- 'up' | 'down' — alert when metric moves this way
  mode text not null default 'delta',   -- 'delta' (vs prev snapshot) | 'level' (absolute)
  threshold numeric not null,           -- pp for rate metrics, rank points for avg_rank
  is_active boolean default true,
  created_at timestamptz default now(),
  constraint geo_alert_rules_direction_chk check (direction in ('up', 'down')),
  constraint geo_alert_rules_mode_chk check (mode in ('delta', 'level'))
);

-- 3. Alert firings
create table if not exists geo_alert_firings (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references geo_alert_rules(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  metric text not null,
  window text,
  fired_at timestamptz default now(),
  metric_value numeric,
  previous_value numeric,
  threshold numeric,
  detail jsonb,
  acknowledged boolean default false
);

create index if not exists geo_alert_rules_brand_idx
  on geo_alert_rules (brand_id, is_active);
create index if not exists geo_alert_firings_brand_idx
  on geo_alert_firings (brand_id, fired_at desc);

-- RLS: org-scoped, mirroring migration_012's brands-policy pattern.
alter table geo_alert_rules enable row level security;
alter table geo_alert_firings enable row level security;

drop policy if exists "member can manage own brand alert rules" on geo_alert_rules;
create policy "member can manage own brand alert rules" on geo_alert_rules
  for all using (
    brand_id in (
      select id from brands
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  )
  with check (
    brand_id in (
      select id from brands
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );

drop policy if exists "member can view own brand alert firings" on geo_alert_firings;
create policy "member can view own brand alert firings" on geo_alert_firings
  for select using (
    brand_id in (
      select id from brands
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );
