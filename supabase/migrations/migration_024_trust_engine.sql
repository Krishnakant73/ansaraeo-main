-- ============================================================================
-- migration_024_trust_engine.sql
-- Phase 2 of AnsarAEO Cloud: AI Trust Engine.
--
-- Adds `trust_records` — the queryable store of verified claims used by the
-- agent (Phase 3) to gate autonomous publish / external-send actions via
-- `assertTrustAbove()`. `claim_id` is content-addressed (sha256(claim|refs))
-- so re-verification is idempotent and never re-spends on LLM calls. Every
-- row carries provenance + a signature (tamper-evident). References
-- `organizations(id)` (the org table is named `organizations`, not `orgs`).
-- RLS is enabled + scoped to org members; the gateway uses the service client
-- (RLS bypass) and enforces tenancy by filtering on organizations.id derived
-- from the API key — see docs/PHASE1_API_GATEWAY.md §6.
--
-- Sequential after migration_023_platform_foundations.sql.
-- ============================================================================

create table trust_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizations(id) on delete cascade,
  claim_id char(64) not null,              -- sha256(claim|evidenceRefs)
  claim text not null,
  method text not null,                    -- deterministic | llm | hybrid
  verdict text not null,                   -- verified | refuted | unverifiable
  score numeric not null,                  -- 0..1
  reasoning text,
  provenance jsonb not null,               -- { engine?, model?, deterministicCheck?, inputsHash, ts }
  signature text not null,                 -- HMAC over claimId|verdict|score|inputsHash
  created_at timestamptz not null default now()
);

create index trust_claim_idx on trust_records (tenant_id, claim_id);

alter table trust_records enable row level security;

create policy "org_members_read_trust_records" on trust_records
  for select
  using (tenant_id in (select org_id from org_members where user_id = auth.uid()));
