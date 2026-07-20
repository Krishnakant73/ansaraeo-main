-- ============================================================
-- Migration 030 — Add OpenRouter engine (additive, off by default)
-- Run after migration_029_engine_workspace.sql.
--
-- OpenRouter is a meta-provider that routes a single API to many upstream
-- LLMs (OpenAI, Anthropic, Google, xAI, etc.). Adding it as a new engine
-- lets us measure whether OpenRouter's default routing surfaces the brand
-- differently than direct engine calls do — additive to chatgpt/perplexity/
-- gemini/grok/copilot/google_ai_overview, not a replacement.
--
-- SEEDED WITH is_active = FALSE. Flip in Supabase Studio (or via the admin
-- panel) after confirming the caller works locally. Also gated behind the
-- `openrouter-engine-enabled` GrowthBook flag from Batch D — you can enable
-- the row and keep the flag off to preview without traffic.
--
-- The caller (src/lib/visibility-engine.ts) skips honestly when
-- OPENROUTER_API_KEY is unset — same pattern as grok/copilot.
-- ============================================================

insert into engines (name, is_active) values
  ('openrouter', false)
on conflict (name) do nothing;
