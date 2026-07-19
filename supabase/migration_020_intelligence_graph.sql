-- ============================================================
-- Migration 020 — AI Discovery Intelligence Platform (the moat layers)
--
-- Extends migration_019's anonymous benchmark warehouse with the graph +
-- analytics layers that turn per-customer runs into the Bloomberg-terminal
-- grade "AI Discovery Intelligence" network.
--
--   L2  AI Discovery Graph + Citation Graph
--        entities            canonical entity registry (brand/source/topic/...)
--        sources             cited-domain authority + trust registry
--        discovery_edges     subject → predicate → object weighted edges
--        graph_metrics       MATERIALIZED node metrics (PageRank, centrality)
--   L1  Trend + Forecast
--        benchmark_trend_cells   per-cell delta / change-point
--        forecast_runs           ETS point + interval forecasts
--   L3  Rankings / Opportunity / Feed
--        brand_ranking_tokens    anonymous public leaderboard identity
--        rankings_monthly        published, k-anon-gated monthly rankings
--        opportunity_recommendations  attributed, RLS org-scoped
--        intelligence_feed_events      global + brand-scoped, published-gated
--
-- Privacy-by-construction: anonymous tables (rankings_monthly,
-- intelligence_feed_events) store NO brand_id and are readable only when
-- published. brand_ranking_tokens maps a brand to a random uuid token; the
-- public leaderboard references the token, never the brand name. Every
-- ADDED brand column is nullable + non-breaking.
-- ============================================================

-- ---------- L2: entities (canonical registry) ----------
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,            -- brand|source|topic|person|product|org|location
  name text not null,
  normalized_key text not null,         -- lower/trim canonical key for dedup
  canonical_id uuid references entities(id) on delete set null, -- merge target
  mention_count int not null default 0,
  authority_score numeric(8,5),
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  unique (entity_type, normalized_key)
);

-- ---------- L2: sources (cited-domain registry, bootstrapped from citations) ----------
create table if not exists sources (
  domain text primary key,              -- mirrors citations.cited_domain
  authority_score numeric(8,5),         -- carried from domain_authority when present
  trust_tier text,                       -- derived from is_trusted_source
  is_trusted_source boolean default false,
  citation_count int not null default 0,
  first_seen timestamptz default now(),
  last_seen timestamptz default now()
);

-- ---------- L2: discovery_edges (the knowledge graph) ----------
create table if not exists discovery_edges (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,           -- entity_type of subject
  subject_key text not null,            -- normalized_key of subject
  predicate text not null,              -- CITES|MENTIONS|RECOMMENDS|COMPETES_WITH|TOPIC_OF|AUTHOR_OF|SCHEMA_FOR|APPEARS_IN_ENGINE
  object_type text not null,
  object_key text not null,
  weight numeric(10,4) not null default 0,   -- accumulated edge strength
  observation_count int not null default 0,
  confidence numeric(4,3) not null default 1,-- 0..1
  engines jsonb not null default '[]'::jsonb,-- engines contributing this edge
  industry_category text not null default 'other',
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  unique (subject_type, subject_key, predicate, object_type, object_key, industry_category)
);

-- ---------- L2: graph_metrics (materialized node metrics) ----------
create table if not exists graph_metrics (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_key text not null,
  pagerank numeric(12,8) not null default 0,
  in_degree int not null default 0,
  out_degree int not null default 0,
  authority_score numeric(8,5),
  computed_at timestamptz default now(),
  unique (entity_type, entity_key)
);

-- ---------- L1: benchmark_trend_cells ----------
create table if not exists benchmark_trend_cells (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_type text not null default 'month',
  dimension_type text not null,
  dimension_value text not null,
  engine text,                           -- null = across engines
  metric text not null,
  value numeric(8,5),
  prior_value numeric(8,5),
  delta numeric(10,5),
  delta_pct numeric(10,5),
  trend_direction text,                  -- up|down|flat
  change_point boolean not null default false,
  z_score numeric(8,4),
  computed_at timestamptz default now(),
  unique (period_start, period_type, dimension_type, dimension_value, engine, metric)
);

-- ---------- L1: forecast_runs ----------
create table if not exists forecast_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,                   -- brand|anonymous
  brand_id uuid references brands(id) on delete cascade,  -- null when anonymous
  dimension_type text not null,
  dimension_value text not null,
  engine text,
  metric text not null,
  horizon_months int not null default 6,
  method text not null default 'ets',
  point_forecast jsonb not null default '[]'::jsonb,   -- [{period, value}]
  lower_band jsonb not null default '[]'::jsonb,
  upper_band jsonb not null default '[]'::jsonb,
  confidence text not null default 'medium',           -- low|medium|high
  insufficient_history boolean not null default false,
  generated_at timestamptz default now(),
  unique (scope, brand_id, dimension_type, dimension_value, engine, metric, horizon_months)
);

-- ---------- L3: brand_ranking_tokens (anonymous public identity) ----------
create table if not exists brand_ranking_tokens (
  brand_id uuid primary key references brands(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  industry_category text not null default 'other',
  region text not null default 'global',
  created_at timestamptz default now()
);

-- ---------- L3: rankings_monthly (published, k-anon gated) ----------
create table if not exists rankings_monthly (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  dimension_type text not null,
  dimension_value text not null,
  rank_metric text not null,
  brand_token uuid not null references brand_ranking_tokens(token),
  value numeric(8,5),
  percentile numeric(6,3),
  rank int,
  published boolean not null default false,
  computed_at timestamptz default now(),
  unique (period_start, dimension_type, dimension_value, rank_metric, brand_token)
);

-- ---------- L3: opportunity_recommendations (attributed, RLS org-scoped) ----------
create table if not exists opportunity_recommendations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  type text not null,                    -- citation_gap|position_gap|intent_coverage|competitor_exposure|schema_missing
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  estimated_impact jsonb not null default '{}'::jsonb,  -- {mentions_per_month, visibility_delta}
  priority_score numeric(6,3),
  status text not null default 'open',   -- open|acknowledged|done|dismissed
  created_at timestamptz default now()
);

-- ---------- L3: intelligence_feed_events (global + brand-scoped, published-gated) ----------
create table if not exists intelligence_feed_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null,                   -- global|industry|brand
  brand_id uuid references brands(id) on delete cascade,  -- set only when scope=brand
  industry_category text,
  region text,
  engine text,
  event_type text not null,
  severity text not null,                -- positive|negative|info
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz default now(),
  published boolean not null default false
);
create index if not exists idx_feed_published on intelligence_feed_events (scope, published, occurred_at desc);

-- ---------- indexes ----------
create index if not exists idx_entities_key on entities (entity_type, normalized_key);
create index if not exists idx_edges_subject on discovery_edges (subject_type, subject_key);
create index if not exists idx_edges_object on discovery_edges (object_type, object_key);
create index if not exists idx_edges_predicate on discovery_edges (predicate, industry_category);
create index if not exists idx_trend_lookup on benchmark_trend_cells (dimension_type, dimension_value, period_start desc);
create index if not exists idx_forecast_lookup on forecast_runs (scope, brand_id, dimension_type, dimension_value, metric);
create index if not exists idx_rankings_lookup on rankings_monthly (dimension_type, dimension_value, rank_metric, period_start desc);
create index if not exists idx_opp_brand on opportunity_recommendations (brand_id, status, priority_score desc);

-- ---------- RLS ----------
alter table entities enable row level security;
alter table sources enable row level security;
alter table discovery_edges enable row level security;
alter table graph_metrics enable row level security;
alter table benchmark_trend_cells enable row level security;
alter table forecast_runs enable row level security;
alter table brand_ranking_tokens enable row level security;
alter table rankings_monthly enable row level security;
alter table opportunity_recommendations enable row level security;
alter table intelligence_feed_events enable row level security;

-- Attributed objects: only the owning org may touch them.
drop policy if exists "member can access own entities" on entities;
create policy "member can access own entities" on entities
  for all using (id in (
    select canonical_id from entities where entity_type = 'brand' and canonical_id in (
      select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  ) or entity_type <> 'brand');

drop policy if exists "authenticated read graph edges" on discovery_edges;
create policy "authenticated read graph edges" on discovery_edges
  for select using (auth.uid() is not null);

drop policy if exists "authenticated read graph metrics" on graph_metrics;
create policy "authenticated read graph metrics" on graph_metrics
  for select using (auth.uid() is not null);

drop policy if exists "authenticated read trend cells" on benchmark_trend_cells;
create policy "authenticated read trend cells" on benchmark_trend_cells
  for select using (auth.uid() is not null);

drop policy if exists "member can access own forecasts" on forecast_runs;
create policy "member can access own forecasts" on forecast_runs
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ) or brand_id is null);

drop policy if exists "member can access own ranking token" on brand_ranking_tokens;
create policy "member can access own ranking token" on brand_ranking_tokens
  for select using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

-- Anonymous published rankings: authenticated users read published rows only.
drop policy if exists "authenticated read published rankings" on rankings_monthly;
create policy "authenticated read published rankings" on rankings_monthly
  for select using (published = true and auth.uid() is not null);

-- Opportunity recs: owning org only.
drop policy if exists "member can access own opportunities" on opportunity_recommendations;
create policy "member can access own opportunities" on opportunity_recommendations
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

-- Feed: brand-scoped rows visible to owning org; global/industry rows only when published.
drop policy if exists "feed access" on intelligence_feed_events;
create policy "feed access" on intelligence_feed_events
  for select using (
    (scope = 'brand' and brand_id in (
      select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
    ))
    or (scope <> 'brand' and published = true and auth.uid() is not null)
  );
