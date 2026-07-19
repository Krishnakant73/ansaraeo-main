-- ============================================================
-- Migration 009 — Mention Verification + Real Google AI Overview
--
-- IMPORTANT CORRECTION: reviewing GetCito's actual source revealed that
-- what we've been calling the "gemini" engine (calling Google's Gemini
-- chatbot API) is NOT the same thing as "Google AI Overviews" (the
-- AI-generated summary box shown directly in Google Search results).
-- These are two different products. Our original Part 3 roadmap listed
-- "Google AI Overviews / Gemini" as one Phase 1 line item, which
-- conflated them. This migration adds a genuinely separate engine for
-- real AI Overview tracking (via SERP scraping, since Google has no
-- public API for AI Overview content) — "gemini" stays as-is for the
-- standalone chatbot.
-- ============================================================

insert into engines (name) values ('google_ai_overview') on conflict (name) do nothing;

-- Track how often the LLM's self-reported mention agreed with a
-- deterministic text-match check — visibility into classification
-- reliability, not just a silent pass-through.
alter table visibility_runs add column if not exists mention_verification jsonb;
