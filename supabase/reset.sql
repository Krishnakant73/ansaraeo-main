-- ============================================================
-- RESET SCRIPT — run this FIRST if you already ran the old schema.sql
-- and are hitting signup/login errors.
--
-- This drops every table + trigger + function from the old schema so you
-- start completely clean. It does NOT delete your actual auth.users
-- (Supabase Auth users) — if you also want to clear out test accounts
-- you created while debugging, do that separately in:
-- Supabase Dashboard > Authentication > Users > (select users) > Delete
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists citations cascade;
drop table if exists visibility_runs cascade;
drop table if exists engines cascade;
drop table if exists prompts cascade;
drop table if exists competitors cascade;
drop table if exists brands cascade;
drop table if exists org_members cascade;
drop table if exists organizations cascade;

-- If you'd already added the pgvector tables from 02-tech-stack-architecture.md, drop those too:
drop table if exists knowledge_chunks cascade;
drop table if exists agent_messages cascade;
drop table if exists agent_conversations cascade;
drop table if exists content_items cascade;
drop table if exists site_audits cascade;
drop table if exists automation_actions cascade;
drop table if exists integrations cascade;

-- Benchmark warehouse (created by migration_019). benchmark_brand_snapshots is
-- dropped via the brands cascade above; benchmark_aggregates has no FK so drop it
-- explicitly. Both are recreated when migration_019 runs after schema.sql.
drop table if exists benchmark_aggregates cascade;
drop table if exists benchmark_brand_snapshots cascade;

-- Now go run schema.sql (the fixed version) in a fresh query.
