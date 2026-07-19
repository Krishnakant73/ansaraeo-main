-- ============================================================
-- Migration 027 — opportunity_recommendations.prompt_id
--
-- Attributes an opportunity to a specific prompt when the underlying
-- signal is prompt-scoped (a specific question your brand is being
-- missed for, versus a brand-level gap). Closes the loop with the
-- prompt-scoped forecast added in the same batch:
--   forecast_runs.dimension_type = 'prompt' — the forecast surface
--   opportunity_recommendations.prompt_id  — the actionable target
--
-- Nullable + no default. Most opportunities remain brand-scoped;
-- prompt attribution is an enrichment, not a requirement. FK on
-- delete set null so a deleted prompt doesn't cascade to opportunity
-- history (audit / trend value preserved).
--
-- Partial index on prompt_id is not-null because the vast majority of
-- rows will remain brand-scoped — indexing only the enriched rows
-- keeps write cost minimal.
-- ============================================================

alter table opportunity_recommendations
  add column if not exists prompt_id uuid references prompts(id) on delete set null;

create index if not exists idx_opportunity_recommendations_prompt
  on opportunity_recommendations (prompt_id, created_at desc)
  where prompt_id is not null;
