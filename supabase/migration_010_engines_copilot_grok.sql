-- ============================================================
-- Migration 010 — Add Copilot + Grok engines
-- Run after migration_009_mention_verification.sql.
-- Widens AI-model coverage from 4 to 6 engines (matches the GEO field).
-- The visibility engine only calls an engine if it is seeded AND active,
-- and each caller degrades gracefully (skips) when its API key is absent,
-- so adding these rows is safe even before keys are configured.
-- ============================================================

insert into engines (name, is_active) values
  ('grok', true),
  ('copilot', true)
on conflict (name) do nothing;
