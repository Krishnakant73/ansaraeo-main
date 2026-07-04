# PART 1 of 6 — Master Roadmap & Positioning
## Building an Indian AEO/AI-Visibility SaaS to Beat Searchable, Profound, Scrunch & Peec AI

> Read this after `searchable-com-research-report.md`. This series assumes: product = AI Search Visibility / AEO platform, database = Supabase, target = India-first, global-later. Files: 01-roadmap (this one), 02-tech-architecture, 03-llm-strategy, 04-feature-spec, 05-ui-ux, 06-gtm-india.

---

## 1. The One-Line Positioning

**"Searchable is built for London/US brands. [YourBrand] is built for India — Hindi + regional language AEO, WhatsApp/UPI-era commerce context, and prices in ₹ that an Indian D2C brand or agency can actually afford."**

This is not a weaker version of Searchable — it's a different center of gravity. Every global AEO tool (Searchable, Profound, Peec AI, Scrunch, Semrush AI Visibility) is built English-first, USD-priced, US/EU-brand-first. None of them properly handle:
- Hindi, Hinglish, Tamil, Bengali, Marathi, Telugu prompts (how a huge chunk of Indian consumers actually ask AI assistants things)
- Indian marketplaces context (Amazon.in, Flipkart, Meesho, Myntra) inside AI shopping answers
- ₹-denominated, SMB-realistic pricing (Indian D2C/SME budgets are 5-10x smaller than US SaaS budgets)
- WhatsApp Business / Google Business Profile signals, which matter more for Indian local businesses than they do in the US

That gap is real, it's measurable (non-English AEO is explicitly called out as underserved even in global market reports), and it's defensible because global players have no incentive to localize deeply for India first — India is a "someday" market for them, not a "day one" market.

---

## 2. Who You're Building For (be specific, don't chase everyone)

Pick ONE primary ICP (Ideal Customer Profile) for the first 6 months. Recommendation, ranked by opportunity:

1. **Indian D2C/e-commerce brands ($1M–$20M revenue)** — fashion, beauty, D2C food, home. They already spend on Google/Meta ads and understand "visibility" as a concept. AI shopping (ChatGPT Shopping, Perplexity Shopping) is new and unclaimed territory for them.
2. **Indian SEO/digital marketing agencies** — they serve 10-50 clients each and need a tool they can white-label. One agency sign-up = many end-brands using your product indirectly. This is the fastest path to volume.
3. **SaaS/B2B companies selling to India + global** — smaller number of these, but higher willingness to pay, and they already think in "visibility/pipeline" language like Searchable's Western customers.

**Recommendation: start with #2 (agencies) as the wedge, because it mirrors exactly how Searchable's own reviews show agencies are a core use case, and one agency relationship compounds into 10-30 brands using you.**

---

## 3. Phased Roadmap

### Phase 0 — Validation (Weeks 1–4)
Goal: prove someone will pay before writing production code.
- Build a **free, no-login "AI Visibility Checker"** (single-page tool): enter your brand + 5 prompts, get an instant snapshot of whether ChatGPT/Perplexity/Gemini mention you. This is your lead magnet AND your validation tool AND your first distribution asset (people share results).
- Manually run this for 20 Indian D2C brands / agencies using scripts (no real backend needed yet — a Python script hitting a few LLM APIs and generating a PDF is enough).
- Get 20 conversations, 5 people who say "I'd pay for this if it ran automatically." That's your green light.

### Phase 1 — MVP (Months 2–4)
Goal: a real, working, paid product with a narrow feature set, sold to 10-20 paying pilot customers (founder-led sales, not self-serve yet).
Core MVP features only:
- Prompt tracking across 3 engines (ChatGPT, Perplexity, Gemini — add Claude, Grok later) in English + Hindi/Hinglish
- Visibility score + competitor comparison (2-3 competitors per brand)
- Weekly email report (not even a full dashboard needed at first — a great email report is often enough to prove value)
- Basic dashboard: visibility trend, mentions list, sources cited
- Manual onboarding (you personally set up their first 20-30 prompts — don't build self-serve prompt discovery yet)

### Phase 2 — V1 Public Launch (Months 5–7)
- Self-serve signup, 14-day trial, ₹ pricing
- Agent/chat interface (plain-English Q&A over their own data — this is the single most-loved feature in Searchable's reviews, prioritize it)
- Content brief generator (AI-assisted, but reviewed by a human template so it doesn't feel "generic" — the #1 complaint about competitors)
- Site audit (schema markup, llms.txt, crawlability checks)
- Agency/white-label mode
- Supabase-backed multi-tenant architecture, proper billing (Razorpay for India + Stripe for global)

### Phase 3 — Differentiation & Moat (Months 8–14)
- **Auto-fix, not just recommend**: one-click schema markup generation + deployment guidance, auto-drafted content pushed straight into WordPress/Shopify/CMS via API, not just a text brief
- Multi-language expansion: proper Hindi, Tamil, Bengali, Marathi prompt tracking with native-speaker-reviewed relevance scoring (not just translated English prompts)
- Revenue attribution: GA4 + Shopify/WooCommerce + CRM integration so a brand can see "AI search → sessions → orders" natively, not bolted on
- Marketplace visibility: track visibility inside Amazon Rufus, Flipkart's AI assistant, and other India-specific AI shopping surfaces as they mature
- Expand engine coverage: DeepSeek, Qwen, and other models with meaningful usage in India/Asia (mentioned as a broad category gap even for global players)

### Phase 4 — Scale (Year 2+)
- International expansion using the same playbook in other underserved-language markets (Southeast Asia, Middle East, Latin America)
- Raise a seed round on the back of real metrics (not just a pitch) — Indian and global AEO investors are already funding this category
- Build the category name in India the way Chris Donnelly is trying to in the West — content, YouTube, LinkedIn, a founder-led brand

---

## 4. Realistic Timeline & Team

| Stage | Duration | Team needed | Est. monthly burn (India) |
|---|---|---|---|
| Phase 0 | 4 weeks | 1 founder (technical) | ~₹0 (scripts + your time) |
| Phase 1 MVP | 3 months | 1-2 devs + founder | ₹1.5-3L/mo |
| Phase 2 V1 | 3 months | 3-4 people (add design + growth) | ₹4-7L/mo |
| Phase 3 | 6 months | 6-10 people | ₹10-20L/mo |

This is deliberately lean. Searchable built its MVP in 60-100 days with 3 technical co-founders — you don't need a huge team to get to a credible V1, you need focus.

---

## 5. What "Beating Every Competitor" Actually Means (be honest with yourself)

You cannot out-fund Profound ($35M) or out-audience Searchable (Chris Donnelly's 2M followers) in year one. You *can*:
1. Be **#1 for Indian-language AEO** — nobody else is even trying
2. Be **#1 on the actionability gap** — auto-fix beats dashboard-only, this is achievable with good engineering, not big funding
3. Be **#1 on trust** — transparent billing, easy cancellation, no dark patterns (Searchable and Semrush both have real complaints here — cheap, easy win)
4. Be **#1 on price-to-value for SMBs** — a genuinely good ₹1,999–₹7,999/mo tier while everyone else prices for enterprise

"Beat every competitor everywhere" is not a real strategy. "Own India's AEO category completely, and win the actionability gap globally" is.

---

*Continue to Part 2: `02-tech-stack-architecture.md` for the full technical architecture and Supabase schema.*
