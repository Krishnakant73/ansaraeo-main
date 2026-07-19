-- ============================================================
-- Migration 017 — History-event alerts
--
-- Negative timeline events (mention lost, citation lost, competitor gained,
-- position dropped, recommendation lost) are the brand's most actionable
-- signals. history_events already records them; this table surfaces them as a
-- dedicated, append-only alert feed — intentionally SEPARATE from the geo
-- rule-based geo_alert_firings (which is metric/threshold based and
-- semantically different).
--
-- Derivation: history-engine.ts inserts one history_alerts row per negative
-- history_events row. event_id is unique (one alert per event) so the insert
-- is idempotent across backfill/retries. The ONLY writers are the derivation
-- path (service client) and the ack endpoint (cookie client, RLS-scoped).
--
-- event_id is NOT a foreign key: history_events has a composite PK
-- (id, occurred_at), so a single-column FK on id is impossible. event_id
-- remains a logical handle (unique-indexed) for idempotency + joins.
--
-- Small table (negative events only) and not partitioned, so the existing
-- ensure_history_partitions() is untouched. RLS funnels through brand_id like
-- the rest of the history tables.
-- ============================================================

create table if not exists history_alerts (
  id uuid not null default gen_random_uuid(),
  brand_id uuid not null,
  prompt_id uuid,
  engine_id uuid,
  engine_name text,
  event_id uuid not null,
  alert_type text not null,
  severity text not null default 'negative',
  occurred_at timestamptz not null default now(),
  detail jsonb,
  acknowledged boolean not null default false,
  primary key (id)
);

create index if not exists history_alerts_brand_time
  on history_alerts (brand_id, occurred_at desc);
create unique index if not exists history_alerts_event_uniq
  on history_alerts (event_id);

alter table history_alerts enable row level security;

drop policy if exists "member can access own history_alerts" on history_alerts;
create policy "member can access own history_alerts" on history_alerts
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
