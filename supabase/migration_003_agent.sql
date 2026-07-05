-- ============================================================
-- Migration 003 — Agent Chat
-- Run after migration_002_billing.sql. Only adds new tables.
-- ============================================================

create table agent_conversations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  user_id uuid references auth.users(id),
  title text,
  created_at timestamptz default now()
);

create table agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references agent_conversations(id) on delete cascade,
  role text not null, -- 'user' | 'assistant'
  content text not null,
  created_at timestamptz default now()
);

alter table agent_conversations enable row level security;
alter table agent_messages enable row level security;

create policy "member can access own agent_conversations" on agent_conversations
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));

create policy "member can access own agent_messages" on agent_messages
  for all using (conversation_id in (
    select id from agent_conversations where brand_id in (
      select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  ));
