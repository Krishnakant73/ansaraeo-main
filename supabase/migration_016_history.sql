-- ============================================================
-- Migration 016 — Historical AI Recommendation Database
--
-- Turns every engine interaction into IMMUTABLE historical knowledge:
--   * history_observations : one append-only snapshot per visibility run
--   * history_events       : derived timeline deltas (first mention, lost
--                             citation, competitor gaining ground, ...)
--
-- Design notes (see plan):
--   * Append-only. App code only INSERTs. The ONLY delete path is the
--     retention prune job (history-prune cron).
--   * brand_id is denormalized onto both tables so RLS funnels through
--     brands exactly like the existing visibility_runs/citations policies.
--   * Native monthly RANGE partitioning on observed_at / occurred_at.
--   * event_type is TEXT (not an enum) so new event types need no migration.
--   * Skipped runs (no AI Overview / missing key / no Copilot proxy) are
--     stored with skipped=true, brand_mentioned=null — real "we checked"
--     history, excluded from mention-rate denominators (skip != not-mentioned).
-- ============================================================

-- per-brand retention tier; default unlimited = keep everything forever
alter table brands add column if not exists history_retention_tier text not null default 'unlimited';

-- ---------- history_observations (partitioned by month) ----------
create table if not exists history_observations (
  id uuid not null default gen_random_uuid(),
  brand_id uuid not null,
  prompt_id uuid not null,
  engine_id uuid,
  engine_name text not null,
  prompt_text text not null,
  run_id uuid references visibility_runs(id) on delete cascade,
  observed_at timestamptz not null default now(),
  skipped boolean not null default false,
  skip_reason text,
  brand_mentioned boolean,
  brand_position int,
  sentiment text,
  recommendation_alignment text,
  competitor_mentions jsonb,
  mention_verification jsonb,
  raw_response text,
  tokens_used int,
  cost_usd numeric(10,4),
  primary key (id, observed_at)
) partition by range (observed_at);

-- ---------- history_events (partitioned by month) ----------
create table if not exists history_events (
  id uuid not null default gen_random_uuid(),
  brand_id uuid not null,
  prompt_id uuid,
  engine_id uuid,
  engine_name text,
  event_type text not null,
  occurred_at timestamptz not null,
  prior_observation_id uuid,
  observation_id uuid not null,
  from_state jsonb,
  to_state jsonb,
  detail jsonb,
  severity text not null default 'info',
  primary key (id, occurred_at)
) partition by range (occurred_at);

-- ---------- indexes (inherited by every partition) ----------
create index if not exists history_obs_brand_time on history_observations (brand_id, observed_at desc);
create index if not exists history_obs_prompt_engine_time on history_observations (brand_id, prompt_id, engine_id, observed_at desc);
create index if not exists history_obs_engine_time on history_observations (engine_name, observed_at desc);
create index if not exists history_obs_run on history_observations (run_id);
-- unique (run_id, observed_at) lets backfill use INSERT ... ON CONFLICT (run_id)
-- for idempotency. Partition key must be part of the unique constraint.
create unique index if not exists history_obs_run_uniq on history_observations (run_id, observed_at);

create index if not exists history_evt_brand_time on history_events (brand_id, occurred_at desc);
create index if not exists history_evt_brand_type_time on history_events (brand_id, event_type, occurred_at desc);
create index if not exists history_evt_prompt_engine_time on history_events (prompt_id, engine_id, occurred_at desc);

-- ---------- RLS (funnel via brand_id, mirroring existing policy shape) ----------
alter table history_observations enable row level security;
alter table history_events enable row level security;

drop policy if exists "member can access own history_observations" on history_observations;
create policy "member can access own history_observations" on history_observations
  for all using (brand_id in (select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())));

drop policy if exists "member can access own history_events" on history_events;
create policy "member can access own history_events" on history_events
  for all using (brand_id in (select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())));

-- ============================================================
-- Partition bootstrap + auto-creation
-- ensure_history_partitions() creates any missing monthly partition for
-- the current month and the next 3 months. Called once at migration time
-- and monthly by the /api/cron/ensure-history-partitions cron so a write
-- never lands in a month with no partition.
-- ============================================================
create or replace function public.ensure_history_partitions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m date;
  start_month date := date_trunc('month', now())::date;
begin
  for i in 0..3 loop
    m := (start_month + (i || ' months')::interval)::date;

    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'history_observations_' || to_char(m, 'YYYY_MM')
    ) then
      execute format(
        'create table if not exists history_observations_%s partition of history_observations for values from (%L) to (%L)',
        to_char(m, 'YYYY_MM'), m, (m + interval '1 month')::date
      );
    end if;

    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'history_events_' || to_char(m, 'YYYY_MM')
    ) then
      execute format(
        'create table if not exists history_events_%s partition of history_events for values from (%L) to (%L)',
        to_char(m, 'YYYY_MM'), m, (m + interval '1 month')::date
      );
    end if;
  end loop;
end;
$$;

select public.ensure_history_partitions();
