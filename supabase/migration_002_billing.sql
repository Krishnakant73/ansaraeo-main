-- ============================================================
-- Migration 002 — Billing
-- Run this AFTER your existing schema.sql — it only ADDS new things,
-- no need to reset your database again.
-- ============================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  razorpay_order_id text not null,
  razorpay_payment_id text,
  plan text not null,           -- 'starter' | 'growth' | 'agency'
  billing_cycle text not null,  -- 'monthly' | 'yearly'
  amount_inr numeric(10,2) not null,
  status text not null default 'created', -- created | paid | failed
  created_at timestamptz default now()
);

alter table payments enable row level security;

create policy "member can view own org payments" on payments
  for select using (org_id in (select org_id from org_members where user_id = auth.uid()));

-- Plan limits reference table — used to enforce (or at least display)
-- how many prompts/engines each plan includes. Matches the pricing
-- tiers in 06-india-gtm-plan.md.
create table plan_limits (
  plan text primary key,
  max_prompts int not null,
  max_engines int not null,
  monthly_price_inr int not null,
  yearly_price_inr int not null
);

insert into plan_limits (plan, max_prompts, max_engines, monthly_price_inr, yearly_price_inr) values
  ('trial', 10, 3, 0, 0),
  ('starter', 30, 3, 2499, 24990),
  ('growth', 100, 5, 7999, 79990),
  ('agency', 500, 8, 14999, 149990)
on conflict (plan) do nothing;
