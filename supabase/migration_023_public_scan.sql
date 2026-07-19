-- ============================================================
-- Migration 023 — Public Scan + Activation Events + Onboarding
--
-- Backing tables for the insight-first onboarding redesign:
--
-- 1. `public_scans` — anonymous, pre-signup brand analyses. A visitor
--    enters a domain, we run 3 canonical prompts × 3 engines live, and
--    persist the whole scan (autofill, prompts, engine results, computed
--    report) so a refresh replays instantly and we can hydrate the scan
--    into a real brand on signup. Written ONLY by the service client
--    from the /api/analyze route; read by /analyze/[scanId]/* pages
--    via the service client. NO RLS grant to authenticated/anon — the
--    service-role bypasses RLS and is the only intended writer/reader.
--
-- 2. `activation_events` — server-side funnel telemetry keyed by user
--    (or IP hash pre-signup). Powers the internal activation admin
--    dashboard and drives event-triggered emails/WhatsApp nudges.
--    Users can read their own events; only the service client writes.
--
-- 3. `brands.onboarding_goal` — one of `chatgpt_mentions`,
--    `beat_competitor`, `fix_site` — chosen on the welcome screen.
--
-- 4. `organizations.mode` — `solo` (default) | `agency` | `enterprise`.
--    Toggled on Welcome if the user reports >1 brand; enterprise via
--    the enterprise contact flow.
--
-- 5. `organizations.whatsapp_phone` — optional Meta-format phone
--    number, encrypted at rest is NOT required here because the number
--    is what the user typed to opt into WhatsApp; it is NOT a
--    credential. Stored plain, opt-in per org.
-- ============================================================

-- ---------- PUBLIC SCANS (anonymous) ----------
create table if not exists public_scans (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  canonical_domain text not null,
  autofill_json jsonb,
  prompts_json jsonb,
  engine_results_json jsonb,
  report_json jsonb,
  ip_hash text,
  status text not null default 'pending', -- 'pending' | 'streaming' | 'ready' | 'failed'
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_brand_id uuid, -- FK not enforced; brand may be deleted independently
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days')
);

create index if not exists public_scans_canonical_domain_idx
  on public_scans (canonical_domain, created_at desc);
create index if not exists public_scans_ip_hash_idx
  on public_scans (ip_hash, created_at desc);

-- Deliberately NO row level security policies — this table is server-only.
-- Any client-side attempt to read via the anon key will simply return
-- zero rows (RLS default deny). All reads/writes go through
-- createServiceClient() in server code.
alter table public_scans enable row level security;

-- ---------- ACTIVATION EVENTS ----------
create table if not exists activation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  event text not null,
  payload jsonb,
  ip_hash text, -- populated for pre-signup events (user_id null)
  at timestamptz default now()
);

create index if not exists activation_events_user_idx
  on activation_events (user_id, at desc);
create index if not exists activation_events_event_idx
  on activation_events (event, at desc);
create index if not exists activation_events_ip_hash_idx
  on activation_events (ip_hash, at desc)
  where user_id is null;

alter table activation_events enable row level security;

create policy "user can view own activation events" on activation_events
  for select using (user_id = auth.uid());

-- ---------- BRAND ONBOARDING GOAL ----------
alter table brands
  add column if not exists onboarding_goal text; -- 'chatgpt_mentions' | 'beat_competitor' | 'fix_site' | null

-- ---------- ORG MODE + WHATSAPP ----------
alter table organizations
  add column if not exists mode text not null default 'solo';
  -- 'solo' | 'agency' | 'enterprise'

alter table organizations
  add column if not exists whatsapp_phone text;
  -- Optional E.164 phone the org has opted into WhatsApp digests on.
  -- Sending is gated by presence of this column value; never used for auth.
