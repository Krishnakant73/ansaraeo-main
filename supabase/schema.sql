-- ============================================================
-- AnsarAEO — Supabase Schema (FIXED — run reset.sql first if re-running)
-- Ref: 02-tech-stack-architecture.md
--
-- WHAT WAS FIXED vs the original version:
-- 1. Added `create extension pgcrypto` explicitly — gen_random_uuid()
--    silently fails on some fresh Supabase projects without this,
--    which breaks EVERY insert (including signup) with a generic
--    "Database error saving new user" message in the Auth logs.
-- 2. Added `set search_path = public` to handle_new_user() — without
--    this, the trigger can fail to find the `organizations`/`org_members`
--    tables in some Postgres/Supabase versions because SECURITY DEFINER
--    functions don't inherit the caller's search_path. This is the #1
--    reported cause of "signup succeeds in Auth but the app is broken
--    afterward" in Supabase's own GitHub issues.
-- 3. Wrapped the trigger body in EXCEPTION handling so that even if
--    something else fails, user creation in auth.users still succeeds —
--    you can debug the org-creation separately instead of signup itself
--    silently breaking.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- ORGANIZATIONS & MEMBERSHIP ----------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial',
  billing_provider text,
  billing_customer_id text,
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'owner',
  primary key (org_id, user_id)
);

-- ---------- BRANDS ----------
create table brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  domain text not null,
  industry text,
  country text default 'IN',
  languages text[] default array['en'],
  created_at timestamptz default now()
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  name text not null,
  domain text
);

-- ---------- PROMPTS & ENGINES ----------
create table prompts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  text text not null,
  language text default 'en',
  category text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table engines (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean default true
);

insert into engines (name) values ('chatgpt'), ('perplexity'), ('gemini')
  on conflict (name) do nothing;

-- ---------- VISIBILITY RUNS ----------
create table visibility_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references prompts(id) on delete cascade,
  engine_id uuid references engines(id),
  run_at timestamptz default now(),
  raw_response text,
  brand_mentioned boolean,
  brand_position int,
  sentiment text,
  tokens_used int,
  cost_usd numeric(10,4)
);

create table citations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references visibility_runs(id) on delete cascade,
  cited_domain text,
  cited_url text,
  is_own_domain boolean,
  is_competitor_domain boolean
);

-- ---------- ROW LEVEL SECURITY ----------
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table brands enable row level security;
alter table competitors enable row level security;
alter table prompts enable row level security;
alter table visibility_runs enable row level security;
alter table citations enable row level security;

create policy "member can view own org" on organizations
  for select using (id in (select org_id from org_members where user_id = auth.uid()));

create policy "member can view own membership rows" on org_members
  for select using (user_id = auth.uid());

create policy "member can access own brands" on brands
  for all using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "member can access own competitors" on competitors
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

create policy "member can access own prompts" on prompts
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

create policy "member can access own visibility_runs" on visibility_runs
  for all using (prompt_id in (
    select id from prompts where brand_id in (
      select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  ));

create policy "member can access own citations" on citations
  for all using (run_id in (
    select id from visibility_runs where prompt_id in (
      select id from prompts where brand_id in (
        select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
      )
    )
  ));

-- ---------- AUTO-CREATE ORG ON SIGNUP (fixed) ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public   -- THE FIX: without this line, the function can
                            -- fail to see the `organizations` table at all
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name, plan)
  values (coalesce(new.raw_user_meta_data->>'company_name', 'My Organization'), 'trial')
  returning id into new_org_id;

  insert into org_members (org_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
exception
  when others then
    -- Log it but don't block the actual auth.users insert — a user account
    -- should still be created even if org-creation has a bug you need to fix.
    raise warning 'handle_new_user() failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
