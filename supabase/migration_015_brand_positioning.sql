-- Track B: Brand Positioning / AI Perception module
-- Intended positioning (owner-declared) + actual perception (LLM-extracted per run).

create table if not exists brand_positioning (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  category text,
  target_customer text,
  differentiators text[],
  best_for text[],
  transformation_from text,
  transformation_to text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
create unique index if not exists brand_positioning_brand_uidx on brand_positioning(brand_id);

create table if not exists brand_perception (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  run_id uuid references visibility_runs(id) on delete cascade,
  engine_id uuid references engines(id) on delete set null,
  perceived_category text,
  strengths text[],
  weaknesses text[],
  recommended_for text[],
  tone text,
  created_at timestamptz default now()
);
create index if not exists brand_perception_brand_idx on brand_perception(brand_id, created_at desc);

-- RLS
alter table brand_positioning enable row level security;
alter table brand_perception enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'brand_positioning' and policyname = 'brand_positioning_org_select'
  ) then
    create policy brand_positioning_org_select on brand_positioning
      for select using (brand_id in (
        select id from brands where org_id in (
          select org_id from org_members where user_id = auth.uid()
        )
      ));
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'brand_positioning' and policyname = 'brand_positioning_org_write'
  ) then
    create policy brand_positioning_org_write on brand_positioning
      for all using (brand_id in (
        select id from brands where org_id in (
          select org_id from org_members where user_id = auth.uid()
        )
      )) with check (brand_id in (
        select id from brands where org_id in (
          select org_id from org_members where user_id = auth.uid()
        )
      ));
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'brand_perception' and policyname = 'brand_perception_org_select'
  ) then
    create policy brand_perception_org_select on brand_perception
      for select using (brand_id in (
        select id from brands where org_id in (
          select org_id from org_members where user_id = auth.uid()
        )
      ));
  end if;
end $$;
