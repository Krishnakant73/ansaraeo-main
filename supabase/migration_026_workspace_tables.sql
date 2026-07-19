-- ============================================================
-- Migration 026 — Phase 3 workspace tables
--
-- Closes three Phase-1/2 deferrals that were all "we'll persist this
-- server-side later" — the "later" is here.
--
-- 1. `recent_objects`
--    ObjectsRail's "Recent" list was localStorage-only, so a teammate
--    couldn't see what they had open on their laptop from their phone,
--    and Chrome incognito wiped it every session. Now: a small ring of
--    the most recent (org, user, kind, ref_id) tuples with a
--    `viewed_at` timestamp. `track_object()` in the app upserts on open.
--
-- 2. `command_events`
--    Command Palette runs were fire-and-forget with no analytics. This
--    logs (org, user, command_id, brand_id, method, ms) so we can rank
--    commands by real frequency later (the palette currently uses a
--    hand-tuned popularity score in code) and audit palette abuse.
--    Method is 'click' | 'keyboard' | 'palette' | 'quick_action'.
--
-- 3. `opportunity_dismissals`
--    "Skip" on a Today's Mission opportunity used to write to
--    localStorage (see the "Phase 2 wires this to a real column" TODO
--    in mission-control/widgets.client.tsx). Now: per-user dismissal
--    of an opportunity by its client-side id (prompt+engine hash) so
--    the same mission doesn't reappear across devices.
--
-- All three are org-scoped, RLS-protected, and additive-only.
-- Follows the sequential-migrations rule from CLAUDE.md.
-- ============================================================

-- ---------- 1. recent_objects ----------
create table if not exists recent_objects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                    -- brand | competitor | prompt | campaign | source | report | benchmark | ...
  ref_id text not null,                  -- brand.id / competitor.id / prompt.id / etc; text so we can key by slug too
  label text,                            -- cached display label (name, question, …) — best-effort, not source of truth
  brand_id uuid references brands(id) on delete cascade,   -- optional back-link when the object belongs to a brand
  viewed_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)         -- one row per (user, object); upsert bumps viewed_at
);

create index if not exists idx_recent_objects_user_time
  on recent_objects (user_id, viewed_at desc);
create index if not exists idx_recent_objects_org_kind
  on recent_objects (org_id, kind, viewed_at desc);

alter table recent_objects enable row level security;

drop policy if exists "user manages own recent objects" on recent_objects;
create policy "user manages own recent objects" on recent_objects
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- 2. command_events ----------
create table if not exists command_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  command_id text not null,              -- matches the id in src/lib/command-registry.ts
  brand_id uuid references brands(id) on delete cascade,   -- set only when the command was brand-scoped
  method text not null default 'palette',-- palette | keyboard | click | quick_action
  ms int,                                -- optional client-side duration ("how long from open to click")
  fired_at timestamptz not null default now(),
  constraint command_events_method_chk check (method in ('palette', 'keyboard', 'click', 'quick_action'))
);

create index if not exists idx_command_events_command_time
  on command_events (command_id, fired_at desc);
create index if not exists idx_command_events_user_time
  on command_events (user_id, fired_at desc);

alter table command_events enable row level security;

-- Insert: own row only. Read: own org (so a team can see palette usage
-- in aggregate later; individual rows still show user_id).
drop policy if exists "user inserts own command events" on command_events;
create policy "user inserts own command events" on command_events
  for insert with check (user_id = auth.uid());

drop policy if exists "member reads org command events" on command_events;
create policy "member reads org command events" on command_events
  for select using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

-- ---------- 3. opportunity_dismissals ----------
create table if not exists opportunity_dismissals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id text not null,          -- the client-side hash (prompt_id + engine, or scan-classifier's synthetic id)
  reason text,                           -- optional: 'not_relevant' | 'already_done' | 'later' — free-form for now
  dismissed_at timestamptz not null default now(),
  unique (brand_id, user_id, opportunity_id)
);

create index if not exists idx_opp_dismissals_brand
  on opportunity_dismissals (brand_id, dismissed_at desc);

alter table opportunity_dismissals enable row level security;

drop policy if exists "member manages own opportunity dismissals" on opportunity_dismissals;
create policy "member manages own opportunity dismissals" on opportunity_dismissals
  for all using (
    brand_id in (
      select id from brands
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
    and user_id = auth.uid()
  )
  with check (
    brand_id in (
      select id from brands
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
    and user_id = auth.uid()
  );
