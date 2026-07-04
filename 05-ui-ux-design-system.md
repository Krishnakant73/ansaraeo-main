# PART 5 of 6 — UI/UX Design System & Core Screens

---

## 1. Design Principles (derived directly from what worked / didn't work for Searchable)

1. **Prioritize, don't dump.** The #1 complaint about Searchable and the category generally is "massive interface, too much to focus on." Every screen should default to a **"Top 5" or "Top 3" view**, with a clear path to "see everything" — never the reverse.
2. **Numbers need a story.** A visibility score of "62" means nothing alone. Always pair a number with a one-line plain-English interpretation ("You're mentioned in 62% of tracked prompts — up 8 points this week, mainly driven by Perplexity").
3. **Design for Hindi/regional scripts from day one.** Devanagari, Tamil, Bengali scripts have different line-height, letter-spacing, and font needs than Latin text. Don't bolt this on later — pick a type system (e.g., Inter for Latin + Noto Sans Devanagari/Tamil/Bengali for regional scripts) now.
4. **Mobile-first dashboard.** Many Indian SMB owners and marketers check dashboards on phone, not desktop, more than Western equivalents. Every core screen must work well at 375px width, not just be "responsive" as an afterthought.
5. **Trust-signaling in the UI itself.** Show data freshness timestamps ("Last checked 6 hours ago"), show your own AI content drafts as "AI Draft — Review Before Publishing" labels (never pretend generated content is human-final) — this builds the trust that competitors are losing.

---

## 2. Visual Identity Direction

- **Tone:** confident, operator-grade, not playful/consumer — your buyer is a marketer or founder who wants to look competent to their boss/client, similar to how Chris Donnelly's own personal brand aesthetic (neutral tones, sharp fonts, minimal distraction) translates well to a B2B analytics tool.
- **Color system:** one strong brand accent (e.g., a deep indigo or a saffron-adjacent warm accent that reads distinctly "Indian tech" without being a cliché flag-color cliché), neutral grays for data-heavy surfaces, a clear semantic palette (green = improving, red = declining, amber = needs attention) used *consistently* across every chart.
- **Typography:** Inter or a similar clean grotesque for UI/Latin text; Noto Sans (regional script variants) for Hindi/Tamil/Bengali/Marathi content; monospace accents for anything showing raw prompts/citations (signals "this is real data, not marketing copy").
- **Data visualization:** Favor simple trend lines and horizontal bar comparisons over busy multi-axis charts — reviewers explicitly praised Searchable's dashboard for surfacing what matters "fast" rather than "drowning you in data."

---

## 3. Core Screens

### A. Onboarding / Setup Wizard
1. Enter brand name + domain + industry + primary language(s)
2. Auto-suggest 20-30 starter prompts based on industry + language (this removes the "blank page" problem — Searchable's onboarding strength was low setup friction)
3. Add 2-3 competitors (auto-suggest based on domain/industry if possible)
4. Show a "first run in progress" loading state, then land directly on populated results (never show an empty dashboard)

### B. Main Dashboard
- Top: Visibility Score (big number) + 7/30-day trend sparkline + one-line plain-English summary
- Second row: "Top 5 Opportunities" card — the single most-loved UX pattern in this category's research, make it the hero of the dashboard, not buried in a menu
- Third row: Share of Voice vs. named competitors (simple horizontal bar chart)
- Sidebar/tabs: Prompts, Citations & Sources, Content Studio, Site Audit, Agent, Settings/Billing

### C. Prompt Detail View
- The exact prompt text, in the language it was tracked in
- Full response text per engine (expandable, not truncated by default — reviewers specifically liked being able to "click into individual prompts to see the full AI responses")
- Highlighted: was the brand mentioned? position? sentiment? which sources were cited?
- One clear CTA: "Generate content brief to improve this prompt" or "Auto-fix suggested issue"

### D. Agent / Chat Screen
- Persistent chat panel, accessible from anywhere (not a separate buried page)
- Suggested starter questions ("Why did visibility drop this week?", "Which prompts are we losing to [Competitor]?")
- Responses should cite the underlying data inline (e.g., "based on 14 runs across ChatGPT and Perplexity this week") — never a vague, ungrounded answer

### E. Content Studio
- List of drafts with clear status labels: Draft (AI-generated, needs review) → In Review → Approved → Published
- Side-by-side view: the target prompt/gap on one side, the draft content on the other
- Never auto-publish without explicit human approval — this is both an ethical/quality safeguard and a direct fix for the "generic AI content" complaint

### F. Site Audit
- Simple scorecard: Schema Markup, Crawlability, Content Structure, llms.txt presence — each with a score and a "Fix this" button
- Fix button opens either (a) auto-generated code snippet to copy-paste, or (b) one-click deploy if a CMS integration is connected

### G. Agency/Multi-Client View (if agency plan)
- Client switcher at the top, aggregate "portfolio visibility" view across all managed brands
- White-label report generator: pick a client, pick a date range, export branded PDF

### H. Billing/Settings
- Crystal clear current plan, usage against plan limits (e.g., "62 of 100 prompts used"), and a **visible, working, one-click cancel button** — no hidden flows. This screen alone is a competitive advantage given the industry's documented billing complaints.

---

## 4. Mobile Considerations
- Dashboard top section (score + top 5 opportunities) must be the very first thing visible on mobile, no horizontal scrolling required
- Agent chat should work as well on mobile as desktop — likely to be checked from phone during a client call
- WhatsApp alert integration (Part 4) doubles as a "mobile dashboard substitute" for users who won't open the web app daily

---

## 5. Suggested Build Approach
- Use **shadcn/ui + Tailwind** components as your base (fast, accessible, easy to theme) rather than building a full custom design system from scratch at MVP stage
- Use **Recharts or Tremor** for the dashboard charts (both integrate cleanly with React/Tailwind stacks)
- Keep a single shared design-tokens file (colors, spacing, type scale) from day one so scaling to new screens/features doesn't cause visual drift — a documented cause of Searchable's "massive interface" complaint as it added features over time

---

*Continue to Part 6: `06-india-gtm-plan.md` for the go-to-market and distribution plan.*
