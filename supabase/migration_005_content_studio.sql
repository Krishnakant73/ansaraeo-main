-- ============================================================
-- Migration 005 — Content Studio
-- Run after migration_004_site_audit.sql. Only adds a new table.
-- ============================================================

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  prompt_id uuid references prompts(id),
  title text,
  status text not null default 'draft', -- draft | in_review | approved | published
  content_markdown text,
  target_engine text,
  -- E-E-A-T / originality checklist — Part 7's Google-safe content design.
  -- Nothing here blocks generation; it blocks APPROVAL in the UI, nudging
  -- a human to add real-world specifics before anything ships.
  eeat_checklist jsonb default '{"has_named_author": false, "has_original_data_point": false, "has_first_hand_detail": false}',
  created_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

alter table content_items enable row level security;

drop policy if exists "member can access own content_items" on content_items;
create policy "member can access own content_items" on content_items
  for all using (brand_id in (
    select id from brands where org_id in (select org_id from org_members where user_id = auth.uid())
  ));
