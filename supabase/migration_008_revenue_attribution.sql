-- ============================================================
-- Migration 008 — Revenue Attribution Integrations (GA4 + Shopify)
--
-- Stores per-BRAND third-party credentials (not your SaaS's own billing —
-- this is the brand's own analytics/commerce accounts, connected so we
-- can show them "AI search -> sessions -> orders -> revenue" for THEIR
-- business, per 04-feature-spec.md's Tier 1 revenue attribution feature).
--
-- NOTE on security: credentials are stored as JSONB here for MVP speed.
-- Before handling real customer credentials at scale, encrypt this column
-- (Supabase Vault, or application-level encryption) rather than storing
-- plaintext API keys/service account JSON directly — flagged honestly,
-- not glossed over.
-- ============================================================

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  provider text not null,        -- 'ga4' | 'shopify'
  status text default 'connected',
  credentials jsonb not null,    -- provider-specific: see settings page for shape
  connected_at timestamptz default now(),
  unique (brand_id, provider)
);

alter table integrations enable row level security;

drop policy if exists "member can access own integrations" on integrations;
create policy "member can access own integrations" on integrations
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));
