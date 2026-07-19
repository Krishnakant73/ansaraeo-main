-- ============================================================
-- Migration 007 — Competitor Mention Tracking + Auto-Discovery
--
-- WHY THIS WAS MISSING BEFORE: the original visibility-engine.ts only
-- classified whether YOUR brand was mentioned. It never checked whether
-- named competitors were mentioned in the same AI response — which means
-- there was no real "Share of Voice vs competitors" data possible, even
-- though the Dashboard UI and Part 4 spec both promised it. This migration
-- + the updated engine fix that gap.
-- ============================================================

-- Store which competitors were mentioned in each run, and in what position,
-- as a JSONB array: [{ "name": "Competitor A", "mentioned": true, "position": 1 }, ...]
alter table visibility_runs add column if not exists competitor_mentions jsonb default '[]';

-- Track how a competitor was added — manual entry vs AI auto-discovery —
-- useful for the UI to show "suggested" vs "confirmed" competitors.
alter table competitors add column if not exists source text default 'manual'; -- 'manual' | 'ai_suggested'
alter table competitors add column if not exists confirmed boolean default true; -- false = suggested, not yet approved by user
