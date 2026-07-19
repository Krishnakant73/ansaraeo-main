-- ============================================================
-- Migration 018 — Historical partition coverage for backfill
--
-- ensure_history_partitions() (migration 016) only guarantees the CURRENT
-- month + the next 3, which is correct for live nightly writes (observed_at
-- defaults to now()). But backfillBrand() now replays each visibility_run's
-- REAL run_at as observed_at/occurred_at (so history is dated correctly),
-- which means a brand with >4 months of history needs partitions for those
-- OLD months too — otherwise the INSERT fails (no partition for that month,
-- and the tables have no DEFAULT partition).
--
-- This adds ensure_history_partitions_for_range(from_date, to_date) which
-- creates any missing monthly partition for BOTH history tables across an
-- arbitrary inclusive month range. backfillBrand() calls it with the
-- min/max run_at of the brand's runs before replaying.
--
-- Reuses the exact partition naming + DDL from migration 016 so live and
-- backfilled partitions are indistinguishable.
-- ============================================================

create or replace function public.ensure_history_partitions_for_range(
  from_date date,
  to_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', from_date)::date;
  end_month date := date_trunc('month', to_date)::date;
  tmp date;
begin
  -- Always iterate forward (handle reversed inputs gracefully).
  if end_month < m then
    tmp := m; m := end_month; end_month := tmp;
  end if;

  loop
    exit when m > end_month;

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

    m := (m + interval '1 month')::date;
  end loop;
end;
$$;
