-- ============================================================
-- Migration 021 — Workflow Operating System (the action layer)
--
-- Turns the analytics/engine layer (opportunity-engine, history-engine,
-- benchmark-engine, intelligence-feed, agent-context, alerts) into a daily
-- workspace: discover → mission → task → generate → approve → deploy →
-- verify → measure → repeat.
--
-- All attributed tables are org-scoped via the existing
--   org_members -> brands -> child
-- chain using auth.uid(). `notifications` is user-scoped. `teams` /
-- `playbooks` are org-scoped. Every ADDED column is nullable + non-breaking.
--
-- IMPORTANT: table order is significant. Postgres evaluates inline FK
-- references at CREATE TABLE time, so FK *targets* (sprints, campaigns,
-- automations) are created BEFORE missions/tasks that reference them.
-- ============================================================

-- ---------- teams (org-scoped collaboration units) ----------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);
create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',          -- member|lead
  created_at timestamptz default now(),
  primary key (team_id, user_id)
);

-- ---------- sprints / campaigns / automations (FK targets, created first) ----------
create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  goal text,
  start_date date,
  end_date date,
  status text not null default 'planned',        -- planned|active|completed
  created_at timestamptz default now(),
  constraint sprints_status_chk check (status in ('planned','active','completed'))
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  objective text,
  status text not null default 'active',         -- active|paused|completed
  created_at timestamptz default now(),
  constraint campaigns_status_chk check (status in ('active','paused','completed'))
);

create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  description text,
  trigger jsonb not null default '{}'::jsonb,    -- {type, config}
  actions jsonb not null default '[]'::jsonb,    -- [{type, config}]
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- missions (objective container for tasks) ----------
create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null,
  objective text,
  status text not null default 'active',         -- active|on_hold|completed|cancelled
  priority int not null default 3,               -- 1 (low) .. 5 (critical)
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  linked_campaign_id uuid references campaigns(id) on delete set null,
  linked_sprint_id uuid references sprints(id) on delete set null,
  due_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint missions_status_chk check (status in ('active','on_hold','completed','cancelled')),
  constraint missions_priority_chk check (priority between 1 and 5)
);

-- ---------- tasks (the unit of work; drives the verification loop) ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  title text not null,
  type text not null default 'fix',              -- fix|content|approve|deploy|verify
  status text not null default 'backlog',        -- backlog|todo|in_progress|in_review|blocked|done|cancelled
  assignee_id uuid references auth.users(id) on delete set null,
  source_opportunity_id uuid references opportunity_recommendations(id) on delete set null,
  source_automation_id uuid references automations(id) on delete set null,
  engine_action jsonb not null default '{}'::jsonb,  -- {engine, route, payload} for deploy/verify
  verification_result jsonb,                     -- diff vs pre-fix baseline
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint tasks_type_chk check (type in ('fix','content','approve','deploy','verify')),
  constraint tasks_status_chk check (status in ('backlog','todo','in_progress','in_review','blocked','done','cancelled'))
);

-- ---------- approvals (role-gated sign-off before deploy) ----------
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  content_item_id uuid references content_items(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  approver_role text not null default 'admin',   -- required org role to sign off
  status text not null default 'pending',        -- pending|approved|rejected
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  note text,
  created_at timestamptz default now(),
  constraint approvals_status_chk check (status in ('pending','approved','rejected'))
);

-- ---------- playbooks (templated mission/task sequences) ----------
create table if not exists playbooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null default 'manual',   -- opportunity_type|engine|manual
  steps jsonb not null default '[]'::jsonb,      -- [{title, type, action}]
  is_active boolean not null default true,
  created_at timestamptz default now(),
  constraint playbooks_trigger_chk check (trigger_type in ('opportunity_type','engine','manual'))
);

-- ---------- notifications (in-app; WhatsApp/email reuse existing channels) ----------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  type text not null,                            -- task_assigned|approval_requested|automation_fired|mention_alert|verify_passed|verify_failed
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  link text,                                     -- deep link into the app
  read boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- indexes ----------
create index if not exists idx_teams_org on teams (org_id);
create index if not exists idx_missions_brand on missions (brand_id, status, priority desc);
create index if not exists idx_tasks_mission on tasks (mission_id, status);
create index if not exists idx_tasks_assignee on tasks (assignee_id, status);
create index if not exists idx_tasks_opportunity on tasks (source_opportunity_id);
create index if not exists idx_sprints_brand on sprints (brand_id, status);
create index if not exists idx_campaigns_brand on campaigns (brand_id, status);
create index if not exists idx_automations_brand on automations (brand_id, is_active);
create index if not exists idx_approvals_brand on approvals (brand_id, status);
create index if not exists idx_approvals_task on approvals (task_id);
create index if not exists idx_playbooks_org on playbooks (org_id, is_active);
create index if not exists idx_notifications_user on notifications (user_id, read, created_at desc);

-- ---------- RLS ----------
alter table teams enable row level security;
alter table team_members enable row level security;
alter table missions enable row level security;
alter table tasks enable row level security;
alter table sprints enable row level security;
alter table campaigns enable row level security;
alter table automations enable row level security;
alter table approvals enable row level security;
alter table playbooks enable row level security;
alter table notifications enable row level security;

-- org-scoped helper: brand must belong to one of the caller's orgs.
drop policy if exists "member can access own teams" on teams;
create policy "member can access own teams" on teams
  for all using (org_id in (select org_id from org_members where user_id = auth.uid()));

drop policy if exists "member can access own team members" on team_members;
create policy "member can access own team members" on team_members
  for all using (team_id in (
    select id from teams where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

drop policy if exists "member can access own missions" on missions;
create policy "member can access own missions" on missions
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

drop policy if exists "member can access own tasks" on tasks;
create policy "member can access own tasks" on tasks
  for all using (mission_id in (
    select id from missions where brand_id in (
      select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  ));

drop policy if exists "member can access own sprints" on sprints;
create policy "member can access own sprints" on sprints
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

drop policy if exists "member can access own campaigns" on campaigns;
create policy "member can access own campaigns" on campaigns
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

drop policy if exists "member can access own automations" on automations;
create policy "member can access own automations" on automations
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

drop policy if exists "member can access own approvals" on approvals;
create policy "member can access own approvals" on approvals
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

drop policy if exists "member can access own playbooks" on playbooks;
create policy "member can access own playbooks" on playbooks
  for all using (org_id in (select org_id from org_members where user_id = auth.uid()));

drop policy if exists "user can access own notifications" on notifications;
create policy "user can access own notifications" on notifications
  for all using (user_id = auth.uid());
