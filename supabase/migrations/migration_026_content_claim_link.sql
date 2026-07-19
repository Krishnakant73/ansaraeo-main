-- ============================================================================
-- migration_026_content_claim_link.sql
-- Phase 3 follow-up: link published knowledge items to the trust-gated claim
-- they were approved from, so the agent's publish / deprecate actions are
-- traceable + reversible (deprecate finds the exact item by claim_id).
--
-- Sequential after migration_025_agent_runtime.sql.
-- ============================================================================

alter table content_items add column if not exists claim_id char(64);

create index if not exists content_items_claim_idx
  on content_items (brand_id, claim_id);
