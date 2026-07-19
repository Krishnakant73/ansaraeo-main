-- ============================================================================
-- migration_023_platform_foundations.sql
-- Phase 1 of AnsarAEO Cloud: Versioned API Gateway + Worker Queue.
--
-- Adds the durable primitives the public platform API and the async worker
-- need. All new tables reference `organizations(id)` (the org table is named
-- `organizations`, not `orgs`). RLS is enabled and scoped to org members;
-- the gateway itself uses the service client (RLS bypass) and enforces
-- tenancy by filtering every query on organizations.id derived from the API
-- key — the critical security property (see docs/PHASE1_API_GATEWAY.md §6).
--
-- Sequential after migration_022_opportunity_unique.sql.
-- ============================================================================

-- ---------- API KEYS (scoped, hashed; raw key shown once at creation) ----------
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  key_hash text not null unique,          -- sha256(raw key); raw never stored
  label text not null,
  scopes text[] not null default '{}',     -- e.g. {visibility:read, visibility:write}
  created_by uuid references auth.users(id),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- JOBS (durable queue; Postgres table-as-queue) ----------
create table jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizations(id) on delete cascade,
  type text not null,                      -- open union: visibility_check|trust_verify|agent_step|...
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',  -- pending|processing|done|failed|dead
  priority int not null default 5,         -- lower = sooner
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  result jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index jobs_pending_idx on jobs (priority, run_at) where status = 'pending';
create index jobs_tenant_idx on jobs (tenant_id);
create index jobs_idem_idx on jobs (idempotency_key) where idempotency_key is not null;

-- ---------- WEBHOOK SUBSCRIPTIONS + DELIVERY LOG ----------
create table webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizations(id) on delete cascade,
  url text not null,
  events text[] not null,
  secret_enc text not null,                -- AES-256-GCM encrypted raw secret (decrypted to sign)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references webhook_subscriptions(id) on delete cascade,
  tenant_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  attempt_count int not null default 0,
  last_status_code int,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz not null default now()
);
create index wh_deliveries_retry_idx on webhook_deliveries (next_retry_at)
  where next_retry_at is not null;

-- ---------- RLS ----------
alter table api_keys enable row level security;
alter table jobs enable row level security;
alter table webhook_subscriptions enable row level security;
alter table webhook_deliveries enable row level security;

-- Org members can manage their org's keys / subscriptions.
create policy "org_members_manage_api_keys" on api_keys
  for all
  using (org_id in (select org_id from org_members where user_id = auth.uid()))
  with check (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org_members_manage_webhook_subs" on webhook_subscriptions
  for all
  using (tenant_id in (select org_id from org_members where user_id = auth.uid()))
  with check (tenant_id in (select org_id from org_members where user_id = auth.uid()));

-- Read-only visibility of a tenant's own jobs / deliveries (gateway uses the
-- service client and scopes by tenant_id itself; these are a secondary guard
-- for any cookie-client console path).
create policy "org_members_read_jobs" on jobs
  for select
  using (tenant_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org_members_read_deliveries" on webhook_deliveries
  for select
  using (tenant_id in (select org_id from org_members where user_id = auth.uid()));
