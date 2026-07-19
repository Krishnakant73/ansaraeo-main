-- ============================================================
-- Migration 024 — Agency roles + share-view tokens
--
-- Agency mode (see migration_023 for organizations.mode) needs richer
-- roles than the current owner-only default:
--
--   owner       — full control (unchanged)
--   strategist  — can access every brand under the org
--   analyst     — access limited to explicit assignments
--   client_view — read-only access to a single brand's reports
--
-- We DON'T change the existing "member can access own brands" RLS
-- policy in schema.sql because owners + strategists should keep
-- unrestricted access. Instead we add a supplementary
-- `agency_brand_access` allowlist table that only analyst/client_view
-- rows care about — the read path checks it via a new dedicated policy.
--
-- Share-view tokens power the Copilot's "send a teammate a view-only
-- link" primitive. A signed URL with a 7-day TTL grants read-only
-- access to a specific brand's report without creating an auth user.
-- ============================================================

-- ---------- role enum widen ----------
-- (Kept as text — enum types are painful to alter in prod.)
alter table org_members
  drop constraint if exists org_members_role_check;

alter table org_members
  add constraint org_members_role_check
  check (role in ('owner', 'strategist', 'analyst', 'client_view'));

-- ---------- allowlist for analyst/client_view ----------
create table if not exists agency_brand_access (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  role text not null check (role in ('analyst', 'client_view')),
  created_at timestamptz default now(),
  unique (user_id, brand_id)
);

alter table agency_brand_access enable row level security;

create policy "member can view own agency access rows" on agency_brand_access
  for select using (user_id = auth.uid());

-- Additional brand-read policy for analyst/client_view. The existing
-- policy in schema.sql still handles owner/strategist (they're members
-- of the org). This adds a second path for narrower roles.
drop policy if exists "agency access can view assigned brands" on brands;
create policy "agency access can view assigned brands" on brands
  for select using (
    id in (select brand_id from agency_brand_access where user_id = auth.uid())
  );

-- ---------- share view tokens ----------
create table if not exists share_view_tokens (
  token uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked boolean not null default false
);

create index if not exists share_view_tokens_brand_idx
  on share_view_tokens (brand_id, expires_at desc);

alter table share_view_tokens enable row level security;

-- Only the creator can list/revoke; validation for the /share/report/[token]
-- route is done via the service client (no RLS needed there).
create policy "creator can manage own share tokens" on share_view_tokens
  for all using (created_by = auth.uid());
