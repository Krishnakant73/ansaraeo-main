# PART 4 of 6 — Full Feature Specification (Mapped to Competitor Gaps)

Every feature below is tagged with **why it beats the competition**, based directly on the gaps found in the Searchable/AEO-category research.

---

## Tier 0: Core Visibility Engine (table stakes — everyone has this, you need it to compete at all)

| Feature | Spec | Competitor gap it closes |
|---|---|---|
| Prompt tracking | User (or auto-suggested) prompts run daily/weekly across engines | Baseline — must match Searchable/Profound/Scrunch |
| Visibility score | 0-100 composite score per brand, trended over time | Baseline |
| Share of voice | % of tracked prompts where you appear vs. named competitors | Baseline |
| Citation/source tracking | Which URLs/domains get cited across your tracked prompts | Baseline |
| Sentiment tracking | Positive/neutral/negative brand mentions | Baseline |

## Tier 1: Differentiators (your actual wedge)

| Feature | Spec | Why it wins |
|---|---|---|
| **Native Hindi/Hinglish/regional-language prompt tracking** | Prompts written and evaluated in Hindi, Hinglish, Tamil, Bengali, Marathi — not machine-translated English prompts. Relevance-scored by native speakers during model tuning. | No competitor does this properly. This is your #1 moat. |
| **Auto-Fix, not just recommendations** | When a gap is found (e.g., missing FAQ schema, thin content), the system doesn't just say "fix this" — it drafts the actual schema markup / content and offers one-click push to WordPress/Shopify/Webflow via API, or a downloadable ready-to-paste fix. | Directly answers the #1 complaint across the entire AEO tool category: the "actionability gap." |
| **Cost-transparent visibility reporting** | Show the customer (in aggregate, not creepy detail) that their visibility data is real, fresh, and computed transparently — "last updated 6 hours ago via live model queries," not stale cached data. | Addresses the "model freeze"/stale-data complaint that's common in G2 reviews across this category. |
| **Revenue attribution built-in, not bolted on** | Native Shopify/WooCommerce/Razorpay + GA4 integration from day one — "AI visibility → sessions → orders → revenue" in one native view. | Most competitors treat this as an integration afterthought; a CMO-ready "AI search made you ₹X this month" report is rare and highly demanded (referenced repeatedly as the #3 complaint: "hard to justify budget internally"). |
| **Transparent, one-click billing** | No dark patterns. Self-serve cancel button that actually cancels immediately, clear proration, no "can't remove card" bugs. | Directly fixes a real, documented trust problem for Searchable and others (multiple Trustpilot complaints). |
| **Genuinely good SMB tier at ₹1,999–₹4,999/mo** | Real feature value at this price (not a crippled teaser tier) — 25-50 prompts, 3 engines, weekly reports, basic audit. | Every well-funded competitor chases enterprise; SMB/solopreneur segment is explicitly called out as underserved. |
| **Marketplace & local-commerce visibility** | Track presence in Amazon.in / Flipkart AI shopping assistants, Google Business Profile-linked AI answers, WhatsApp Business catalog signals | India-specific commerce context no global tool tracks. |

## Tier 2: The Agent (highest-loved feature type in existing reviews — invest here)

- Conversational interface over the brand's own visibility data: "Which prompts are we losing to [competitor]?", "Why did our visibility drop this week?", "Draft me a content brief for our weakest prompt."
- Built on RAG (pgvector, see Part 2) over the brand's own `visibility_runs`, `citations`, and `content_items` — not a generic LLM wrapper with no real data grounding.
- Should proactively surface a "Top 5 opportunities" digest (matches the most-loved UX pattern from Searchable reviews: reduces overwhelm, drives daily habit).

## Tier 3: Agency Features (your fastest distribution wedge — see Part 6)

- Multi-client dashboard, white-label PDF/branded reports
- "Pitch mode" — generate a free/lite audit for a prospect brand without needing their site access, to use in new-business pitches (Searchable users specifically praised this)
- Bulk seat/workspace management, role-based permissions

## Tier 4: Content & Technical Studio

- AI-assisted content brief and draft generation — but with a **human-reviewed template layer** so output doesn't feel generic (a direct, named complaint about Searchable's AI content quality)
- Technical site audit: schema markup validator, robots.txt/llms.txt checker, crawlability report, Core Web Vitals tie-in
- Structured data generator: FAQ schema, Product schema, Organization schema — auto-generated and downloadable/deployable

## Tier 5: Reporting & Alerts

- Nightly automated visibility runs (batch API, see Part 3)
- Daily "Top 5 opportunities" email digest
- Weekly summary report (PDF/branded for agencies)
- Slack/WhatsApp Business alert integration for real-time visibility drops (WhatsApp specifically, since it's the dominant business communication channel in India — no global competitor prioritizes this)

---

## Feature Prioritization Matrix (MoSCoW for MVP)

**Must-have (Phase 1 MVP):** prompt tracking (EN + HI/Hinglish), visibility score, competitor comparison, weekly email report, basic dashboard

**Should-have (Phase 2 V1):** Agent chat, content brief generator, site audit, agency white-label, self-serve billing

**Could-have (Phase 3):** auto-fix/one-click deploy, revenue attribution, marketplace visibility, WhatsApp alerts, multi-language expansion beyond Hindi

**Won't-have (yet):** self-hosted models/speculative decoding infra, enterprise SSO/compliance, voice-search-specific optimization — these are real but not needed to win your first 100-1,000 customers

---

*Continue to Part 5: `05-ui-ux-design-system.md` for the design system, core screens, and user flows.*
