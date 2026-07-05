# How to Merge This Into Your Existing `ansaraeo-main` Repo

## 1. Install the one new dependency
```bash
npm install @supabase/ssr @supabase/supabase-js
```

## 2. Copy these files into your repo (same relative paths)
```
supabase/schema.sql                          → new folder, just for reference/version control
src/lib/supabase/client.ts                   → new
src/lib/supabase/server.ts                   → new
src/middleware.ts                            → new (repo root of src/, next to app/)
src/app/(auth)/login/page.tsx                → new route group
src/app/(auth)/signup/page.tsx               → new route group
src/app/api/visibility-check/route.ts        → new API route
.env.example                                  → new (copy to .env.local and fill in real keys)
```

Note: your existing `src/app/(marketing)/` route group already holds your public pages
(`page.tsx`, `product/page.tsx`, etc.) — `(auth)` is a **new, separate** route group at the
same level, so `/login` and `/signup` will resolve correctly without touching your
marketing routes.

## 3. Run the schema
1. Go to your Supabase project → SQL Editor → New Query
2. Paste the entire contents of `supabase/schema.sql`
3. Run it. This creates all tables, Row Level Security policies, and the
   auto-create-organization trigger described in `02-tech-stack-architecture.md`.

## 4. Fill in `.env.local`
Get your Supabase keys from **Project Settings → API**. Get OpenAI/Perplexity keys from
their respective dashboards. Never commit `.env.local` — it's already covered by your
existing `.gitignore` (`.env*` is in there).

## 5. Test the core loop end-to-end
```bash
npm run dev
```
1. Go to `localhost:3000/signup`, create an account → this fires the `handle_new_user()`
   trigger and creates your first organization automatically.
2. In the Supabase Table Editor, manually insert one row into `brands` (use your new
   `org_id` from the `organizations` table) and one row into `prompts` for that brand.
3. Call the tracking route directly to test it:
   ```bash
   curl -X POST http://localhost:3000/api/visibility-check \
     -H "Content-Type: application/json" \
     -d '{"promptId": "paste-the-prompt-id-here"}'
   ```
4. Check the `visibility_runs` table in Supabase — you should see a real row with
   `raw_response`, `brand_mentioned`, `sentiment` filled in from an actual ChatGPT call.

That row appearing is your genuine "hello world" moment — the entire product's core loop
(prompt → real LLM call → classification → stored result) is now working end-to-end.

## 6. What's still missing (next coding session)
Ranked by what unlocks the most value next, per `01-master-roadmap.md` Phase 1:

1. **Onboarding flow** — a form after signup to create the first `brand` + auto-suggest
   20-30 starter `prompts` (right now this is a manual Supabase Table Editor insert — fine
   for your own testing, not for a real user)
2. **`/dashboard` page** — replace `DashboardPreview.tsx`'s hardcoded mock arrays with a
   real Supabase query (`select * from visibility_runs join prompts...`) scoped to the
   logged-in user's brand
3. **Scheduler** — wrap `/api/visibility-check` in a Supabase Cron job (or Trigger.dev) that
   loops over every active prompt nightly, instead of calling it manually
4. **Perplexity + Gemini engines** — the route already has `callPerplexity()` written;
   wire it into the same POST handler as a second/third call per prompt
5. **Billing** — Razorpay checkout + webhook to update `organizations.plan`

Tell me which of these five you want built next and I'll write it the same way — real,
runnable code, not pseudocode.
