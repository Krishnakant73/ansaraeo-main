-- ============================================================
-- Migration 029 — AI Engine workspace tables
--
-- Promotes each AI engine to a first-class object. Mirrors the
-- shape of 028 (competitor workspace) but scoped by
-- (engine_id, brand_id) since engines live in a global table and
-- their behavior is only meaningful in the context of a brand's
-- runs.
--
-- Four additions:
--   1. engine_personalities — deterministic six-axis scoring cache.
--      Re-derived by the nightly cron (src/lib/engine-personality.ts);
--      the table is a cache of derived facts, not a source of truth.
--   2. engine_snapshots — daily rollup of mention rate / citation
--      posture per (engine, brand). Powers the Model Changes tab
--      without recomputing from visibility_runs on every load.
--   3. engine_change_events — detected step-changes and manual
--      annotations. The AI Change Log renders these.
--   4. opportunity_recommendations.engine_id — pairs with the
--      prompt_id + competitor_id FKs added earlier. Same nullable
--      pattern; most opportunities remain brand-scoped and engine
--      attribution is an enrichment for engine-specific moves.
-- ============================================================

-- 1. Deterministic personality scoring cache.
create table if not exists engine_personalities (
  id uuid primary key default gen_random_uuid(),
  engine_id uuid not null references engines(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  verbosity numeric(5,2) not null default 0,          -- 0..100 each
  hedging numeric(5,2) not null default 0,
  format_bias numeric(5,2) not null default 0,
  freshness_bias numeric(5,2) not null default 0,
  citation_density numeric(5,2) not null default 0,
  entity_resolution numeric(5,2) not null default 0,
  sample_run_ids uuid[] not null default '{}',
  runs_observed integer not null default 0,
  computed_at timestamptz not null default now(),
  unique (engine_id, brand_id)
);

create index if not exists idx_engine_personalities_brand
  on engine_personalities (brand_id, engine_id);

alter table engine_personalities enable row level security;

-- Reads inherit from the parent brand.
create policy engine_personalities_read_by_org
  on engine_personalities for select
  using (
    exists (
      select 1
      from brands b
      join org_members om on om.org_id = b.org_id
      where b.id = engine_personalities.brand_id
        and om.user_id = auth.uid()
    )
  );

-- Writes come from the service role (nightly cron).
-- No user-write policy — a denied write is the correct RLS default.

-- 2. Daily rollup. One row per (engine, brand, day).
create table if not exists engine_snapshots (
  id uuid primary key default gen_random_uuid(),
  engine_id uuid not null references engines(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  captured_on date not null,
  mention_rate numeric(5,2),          -- 0..100
  avg_position numeric(4,2),
  citation_share numeric(5,2),        -- 0..100, citations per run scaled
  own_citation_share numeric(5,2),    -- 0..100, own-domain share of citations
  runs_observed integer not null default 0,
  created_at timestamptz not null default now(),
  unique (engine_id, brand_id, captured_on)
);

create index if not exists idx_engine_snapshots_engine_day
  on engine_snapshots (engine_id, captured_on desc);
create index if not exists idx_engine_snapshots_brand_day
  on engine_snapshots (brand_id, captured_on desc);

alter table engine_snapshots enable row level security;

create policy engine_snapshots_read_by_org
  on engine_snapshots for select
  using (
    exists (
      select 1
      from brands b
      join org_members om on om.org_id = b.org_id
      where b.id = engine_snapshots.brand_id
        and om.user_id = auth.uid()
    )
  );

-- 3. Detected + manual change events. Global-ish rows — the RLS
-- policy scopes access to orgs whose brands have runs referenced
-- in evidence_run_ids. Manual entries (kind='manual', no evidence)
-- fall back to per-brand attribution via optional brand_id.
create table if not exists engine_change_events (
  id uuid primary key default gen_random_uuid(),
  engine_id uuid not null references engines(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,    -- optional attribution for manual entries
  occurred_on date not null,
  kind text not null check (kind in ('baseline_drift','citation_shift','format_shift','manual')),
  magnitude numeric(6,2),
  summary text not null,
  evidence_run_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_engine_change_events_engine_day
  on engine_change_events (engine_id, occurred_on desc);
create index if not exists idx_engine_change_events_brand
  on engine_change_events (brand_id, occurred_on desc)
  where brand_id is not null;

alter table engine_change_events enable row level security;

create policy engine_change_events_read_by_org
  on engine_change_events for select
  using (
    -- Brand-attributed rows: caller must belong to that brand's org.
    (
      brand_id is not null and exists (
        select 1
        from brands b
        join org_members om on om.org_id = b.org_id
        where b.id = engine_change_events.brand_id
          and om.user_id = auth.uid()
      )
    )
    or
    -- Evidence-attributed rows: caller must own at least one referenced run.
    (
      cardinality(evidence_run_ids) > 0 and exists (
        select 1
        from visibility_runs vr
        join prompts p on p.id = vr.prompt_id
        join brands b on b.id = p.brand_id
        join org_members om on om.org_id = b.org_id
        where vr.id = any(engine_change_events.evidence_run_ids)
          and om.user_id = auth.uid()
      )
    )
  );

-- 4. Engine attribution on opportunity recommendations. Nullable —
-- an opportunity remains brand-scoped and gets engine attribution
-- when the recommendation is engine-specific ("post FAQ tuned for
-- ChatGPT prescriptive answers"). type='engine_optimization' is
-- the conventional value; the type column is an open string so no
-- check constraint needs to change.
alter table opportunity_recommendations
  add column if not exists engine_id uuid references engines(id) on delete set null;

create index if not exists idx_opportunity_recommendations_engine
  on opportunity_recommendations (engine_id, created_at desc)
  where engine_id is not null;

comment on table engine_personalities is
  'Cache of deterministic six-axis engine personality scoring (verbosity, hedging, format_bias, freshness_bias, citation_density, entity_resolution). Re-derived nightly; RLS scopes reads by org via brand_id.';
comment on table engine_snapshots is
  'Daily rollup of mention rate / avg position / citation posture per (engine, brand). Written by the service role; RLS scopes reads by org via brand_id.';
comment on table engine_change_events is
  'Detected step-changes and manual annotations for the AI Change Log. RLS scopes reads by org via brand_id (attributed) or by ownership of any referenced evidence run.';
