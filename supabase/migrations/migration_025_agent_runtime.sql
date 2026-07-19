-- Phase 3 — AI Discovery Agent Runtime
-- Agent tasks, governance policies, and the human-in-the-loop approval queue.
-- Sequential after migration_024 (trust engine). The agent service uses the
-- SERVICE client (RLS bypass) for trusted execution, exactly like the
-- visibility + trust engines; user-facing reads below are RLS-scoped to the
-- org. See docs/PHASE3_AGENT_RUNTIME.md.

create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  policy_id uuid references governance_policies(id) on delete set null,
  goal text not null,
  state text not null default 'planning',  -- planning|executing|awaiting_approval|done|failed
  plan jsonb,                              -- AgentStep[] (inspectable + replayable)
  guardrails jsonb,                        -- { maxExternalSends?, requireApproval? }
  created_at timestamptz not null default now()
);
create index agent_tasks_tenant_idx on agent_tasks (tenant_id);
create index agent_tasks_brand_idx on agent_tasks (brand_id);

create table governance_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  rules jsonb not null,    -- engines, guardrails, required approvals, trust threshold
  updated_at timestamptz not null default now()
);
create index governance_policies_org_idx on governance_policies (org_id);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references agent_tasks(id) on delete cascade,
  step_id text not null,
  action text not null,    -- publish|deprecate|external_send
  status text not null default 'pending',  -- pending|approved|rejected
  decided_by uuid references auth.users(id),
  decided_at timestamptz
);
create index approval_requests_task_idx on approval_requests (task_id);

-- RLS: org members may read their org's agent state (the service client bypasses
-- this for trusted execution; the cookie client respects it for dashboards).
alter table agent_tasks enable row level security;
create policy "org_members_read_agent_tasks" on agent_tasks
  for select
  using (tenant_id in (select org_id from org_members where user_id = auth.uid()));

alter table governance_policies enable row level security;
create policy "org_members_read_governance_policies" on governance_policies
  for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

alter table approval_requests enable row level security;
create policy "org_members_read_approval_requests" on approval_requests
  for select
  using (
    task_id in (
      select id from agent_tasks
      where tenant_id in (select org_id from org_members where user_id = auth.uid())
    )
  );
