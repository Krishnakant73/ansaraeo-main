# PART 2 of 6 — Tech Stack & Supabase Architecture

---

## 1. Recommended Full Stack

| Layer | Choice | Why |
|---|---|---|
| Database + Auth + Storage + Realtime | **Supabase** (as you requested) | Postgres-based, bundles auth/storage/realtime/edge functions, generous free tier, $25/mo Pro covers you through early growth, pgvector built in for embeddings/RAG |
| Frontend | **Next.js (React) + Tailwind + shadcn/ui** | Fast to build, great for dashboards, huge talent pool in India, SSR helps your own marketing pages rank in SEO/AEO (practice what you preach) |
| Backend/API | **Next.js API routes or a separate Node/Fastify service** for heavy jobs | Keep prompt-running/scraping jobs out of your web request path |
| Job queue / scheduling | **Supabase Cron + Edge Functions** for light jobs; **Trigger.dev or a self-hosted queue (BullMQ + Redis)** for heavy/parallel LLM-calling jobs | Running thousands of prompts across multiple LLMs daily is a queue-heavy workload, not a simple cron job |
| LLM orchestration | Your own routing layer (see Part 3) calling OpenAI, Anthropic, Google, Perplexity, DeepSeek APIs | Multi-engine tracking is the core product — build this as a first-class internal service, not an afterthought |
| Vector search / RAG | **pgvector inside Supabase** | No need for a separate vector DB at MVP/V1 scale; Supabase's Postgres extension handles it |
| Payments | **Razorpay** (India, UPI/cards/netbanking) + **Stripe** (international, when you expand) | Razorpay is the default choice for Indian SaaS billing |
| Email | **Resend** or **Postmark** for transactional; a proper ESP (e.g., Customer.io) later for lifecycle emails | Weekly reports are a core feature — treat email deliverability seriously from day one |
| Hosting/Infra | **Vercel** (frontend) + **Railway or Fly.io** (background workers) or **AWS Mumbai region** for India data residency if enterprise clients need it | Vercel is fastest to ship; move heavier compute (LLM job runners) to a service designed for long-running jobs |
| Observability | **Sentry** (errors) + **PostHog** (product analytics, also self-hostable, India-friendly on cost) | You need to see where in the funnel Indian SMBs drop off |
| Site audit / crawling | **Playwright** (headless browser) for scraping/rendering brand sites, checking schema markup, robots.txt, llms.txt | Needed for the technical audit feature |

---

## 2. High-Level Architecture (textual diagram)

```
                        ┌─────────────────────┐
                        │   Next.js Frontend    │  (dashboard, marketing site, agent chat UI)
                        └──────────┬───────────┘
                                   │ REST/RPC (Supabase client + your API routes)
                        ┌──────────▼───────────┐
                        │   Supabase (Postgres) │  Auth, RLS, Storage, Realtime, pgvector
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              │                    │                      │
    ┌─────────▼────────┐ ┌─────────▼─────────┐  ┌─────────▼─────────┐
    │  Job Queue Worker │ │  LLM Router Service │  │  Audit/Crawler     │
    │ (BullMQ/Trigger)  │ │  (Part 3 detail)    │  │  Service (Playwright)│
    └─────────┬────────┘ └─────────┬─────────┘  └─────────┬─────────┘
              │                    │                       │
     runs scheduled prompts   calls OpenAI/Anthropic/    crawls brand websites,
     across all tracked        Google/Perplexity/         checks schema/llms.txt,
     brands nightly            DeepSeek APIs               stores results in Supabase
              │                    │                       │
              └────────────────────┴───────────────────────┘
                                   │
                        writes results back into Supabase
                        (visibility_runs, citations, mentions tables)
```

---

## 3. Supabase Database Schema (core tables)

This is a starting schema — expand as features grow. Use Postgres Row Level Security (RLS) on every table since you're multi-tenant (agencies manage multiple client brands).

```sql
-- ORGANIZATIONS & USERS (multi-tenant core)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial', -- trial | starter | growth | agency | enterprise
  billing_provider text, -- 'razorpay' | 'stripe'
  billing_customer_id text,
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member', -- owner | admin | member
  primary key (org_id, user_id)
);

-- BRANDS (an org can track multiple brands, e.g. an agency)
create table brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  domain text not null,
  industry text,
  country text default 'IN',
  languages text[] default array['en'], -- 'en','hi','hinglish','ta','bn', etc.
  created_at timestamptz default now()
);

-- COMPETITORS (per brand)
create table competitors (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  name text not null,
  domain text
);

-- PROMPTS (the tracked queries — the heart of the product)
create table prompts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  text text not null,
  language text default 'en',
  category text, -- 'informational' | 'comparison' | 'transactional' | etc.
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ENGINES (the LLM/platforms you track)
create table engines (
  id uuid primary key default gen_random_uuid(),
  name text unique not null, -- 'chatgpt' | 'perplexity' | 'gemini' | 'claude' | 'deepseek' | 'google_aio'
  is_active boolean default true
);

-- VISIBILITY RUNS (one row per prompt x engine x run)
create table visibility_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references prompts(id) on delete cascade,
  engine_id uuid references engines(id),
  run_at timestamptz default now(),
  raw_response text,          -- store full response for audit/debugging
  brand_mentioned boolean,
  brand_position int,         -- rough rank/position within the answer, if applicable
  sentiment text,             -- 'positive' | 'neutral' | 'negative'
  tokens_used int,
  cost_usd numeric(10,4)
);

-- CITATIONS / SOURCES (which URLs the engine cited in that run)
create table citations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references visibility_runs(id) on delete cascade,
  cited_domain text,
  cited_url text,
  is_own_domain boolean,
  is_competitor_domain boolean
);

-- SITE AUDITS
create table site_audits (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  run_at timestamptz default now(),
  schema_markup_score int,
  crawlability_score int,
  llms_txt_present boolean,
  issues jsonb   -- structured list of found issues + suggested fixes
);

-- CONTENT BRIEFS / GENERATED CONTENT
create table content_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  prompt_id uuid references prompts(id),
  title text,
  status text default 'draft', -- draft | approved | published
  content_markdown text,
  target_engine text,
  created_at timestamptz default now()
);

-- AGENT CONVERSATIONS (the chat/agent feature)
create table agent_conversations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

create table agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references agent_conversations(id) on delete cascade,
  role text not null, -- 'user' | 'assistant'
  content text not null,
  created_at timestamptz default now()
);

-- EMBEDDINGS for RAG over the brand's own data + content (pgvector)
create extension if not exists vector;
create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  source text, -- 'site_page' | 'visibility_run' | 'content_item'
  content text,
  embedding vector(1536)
);
create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops);
```

**Row Level Security pattern** (apply to every table with `org_id`/`brand_id`):
```sql
alter table brands enable row level security;
create policy "org members can access their brands"
  on brands for all
  using (org_id in (select org_id from org_members where user_id = auth.uid()));
```

---

## 4. Why This Schema Design Matters for Differentiation

- `visibility_runs` storing `tokens_used` and `cost_usd` per run from day one means you can build real cost-transparency into your own product economics AND eventually show customers exactly what "AI visibility" costs to produce (nobody else does this — could be a unique selling point: "we show you our data cost, not just our data").
- `citations` table with `is_own_domain`/`is_competitor_domain` flags is what powers the "who's winning this prompt" comparison view — the single most-loved feature type across every competitor's reviews.
- `knowledge_chunks` + pgvector is what makes your "Agent" chat feature actually work well — RAG over the brand's own visibility history, not just a generic LLM wrapper.
- Multi-language built into `prompts.language` and `brands.languages` from the *first schema version* — retrofitting multilingual support later is painful; baking it in now is your core moat.

---

*Continue to Part 3: `03-llm-strategy-and-token-optimization.md` for how to run thousands of LLM calls affordably, the DeepSeek-V4/DSpark/DeepSpec question, and the specific token-cost-control techniques you should actually use.*
