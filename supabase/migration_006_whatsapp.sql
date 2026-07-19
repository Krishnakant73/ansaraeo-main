-- ============================================================
-- Migration 006 — WhatsApp Automation (Part 7)
-- Run after migration_005_content_studio.sql.
-- ============================================================

-- Store the connected WhatsApp number per organization
alter table organizations add column if not exists whatsapp_number text;
alter table organizations add column if not exists whatsapp_verified boolean default false;

-- Every automated action gets logged here — full auditability, per
-- Part 7 Section 4's guardrails ("Rate-limit and log every automated action")
create table if not exists automation_actions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  action_type text not null,        -- 'send_whatsapp_digest' | 'whatsapp_approval_request' | 'publish_wordpress'
  content_item_id uuid references content_items(id),
  status text not null default 'pending', -- pending | approved | executed | failed | rejected
  approved_by uuid references auth.users(id),
  approved_via text,                -- 'whatsapp' | 'email' | 'dashboard'
  executed_at timestamptz,
  details jsonb,
  created_at timestamptz default now()
);

alter table automation_actions enable row level security;

drop policy if exists "member can access own automation_actions" on automation_actions;
create policy "member can access own automation_actions" on automation_actions
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));
