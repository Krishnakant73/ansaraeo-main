# PART 3 of 6 — LLM Strategy & Token Cost Optimization

---

## 1. First, an honest answer about the links you shared

You asked about the YouTube video and these two links:
- `huggingface.co/deepseek-ai/DeepSeek-V4-Pro-DSpark`
- `github.com/deepseek-ai/DeepSpec`

I checked both directly. Here's what they actually are, in plain terms:

**DeepSeek-V4** is a real, new open-weight model release from DeepSeek (1.6T total params / 49B activated for "Pro", 284B/13B for "Flash", 1-million-token context window). It's genuinely competitive with frontier closed models like GPT and Gemini on several benchmarks. It's MIT-licensed, meaning you can self-host it.

**"DSpark"** is *not* a separate model — it's the same DeepSeek-V4 checkpoint with a **speculative decoding module** attached. Speculative decoding is a technique where a small, fast "draft" model predicts several tokens ahead, and the big model just verifies them, which speeds up inference and cuts compute cost **if you are self-hosting the model on your own GPUs.**

**DeepSpec** (the GitHub repo) is the **training codebase DeepSeek used to build that draft model** — it's a research tool for training and evaluating speculative-decoding draft models (like DSpark, DFlash, Eagle3). It requires 8 GPUs, tens of terabytes of storage for the training cache, and real ML engineering effort.

**The honest bottom line for your SaaS:** DeepSpec is not a "token cost control tool" for a typical SaaS founder. It's advanced infra for teams who are self-hosting open-weight models on their own GPU clusters and want to make that self-hosted inference faster/cheaper. At your MVP/V1 stage, you will almost certainly be calling LLMs via API (OpenAI, Anthropic, Google, DeepSeek's own hosted API, Perplexity), not running your own GPU cluster — so DeepSpec is not something you need yet. File it away as a "maybe in 18-24 months if you're running your own inference at scale" tool, not a day-one tool.

As for the YouTube video on controlling LLM token usage — I wasn't able to pull its transcript directly, so I won't pretend to summarize content I couldn't verify. But the actual, proven techniques for controlling token costs (which is what matters for you) are all listed below in Section 3, and they don't require anything as advanced as training your own draft model.

---

## 2. Why LLM Cost Control Is a *Core* Product Problem for You, Not a Side Issue

Remember from the Searchable research: **tokenization/LLM API cost is explicitly called out as driving 65% of unexpected AI costs** in this exact category, and **non-English content costs 2-7x more in tokens** than English. Since your whole differentiation is Hindi/regional language support, you will hit this problem harder than Searchable does. You must design for it from day one, not retrofit it later.

Your core cost driver: to give one brand a "visibility score," you're running N tracked prompts × M engines × daily = a lot of API calls, every single day, for every customer, whether they log in or not. This is fundamentally different from a normal SaaS where compute cost roughly follows usage — your compute cost runs whether or not the customer is even using the product that day. Get this wrong and you lose money on every customer.

---

## 3. Concrete Token/Cost Optimization Techniques (in priority order)

### A. Model routing / tiering (biggest lever)
Don't use the same expensive model for everything. Route by task:
- **Simple classification tasks** (e.g., "did this response mention the brand? yes/no") → cheapest/smallest models (e.g., GPT-4o-mini, Gemini Flash, DeepSeek's cheaper tier, Claude Haiku)
- **Sentiment/position extraction** → small-to-mid models
- **Content brief generation, the Agent chat feature** → your best available model, since quality directly drives perceived value and this is a lower-volume task than prompt-tracking
- **Actual "what does ChatGPT/Perplexity say about this brand" tracking** → you generally *must* call the real target engine's actual consumer-facing model (that's the whole point — you're measuring what real users see), so this cost is largely fixed. Optimize everything *around* it instead.

### B. Prompt caching
Most major providers (OpenAI, Anthropic, Google) now support prompt caching for repeated system prompts/context. If you're running the same instructions across thousands of prompt-checks, structure your calls so the repeated instruction/context portion is cached and only the variable part (the specific prompt + brand) is fresh. This alone can cut costs significantly on repeated-structure workloads like yours.

### C. Batch APIs
OpenAI, Anthropic, and Google all offer batch/async processing at a discount (often 50% cheaper) for non-real-time workloads. Your nightly visibility runs are *exactly* this use case — they don't need to be real-time, they run on a schedule. Use batch endpoints for all scheduled tracking runs; reserve real-time calls for the interactive Agent chat feature only.

### D. Smart de-duplication and sampling
- Don't re-run identical prompts for every brand separately if multiple brands in the same industry track similar prompts — cache/share generic industry-level results where it doesn't compromise per-brand accuracy (careful: don't share brand-specific competitive data across customers, only shared generic category research).
- Not every prompt needs daily refresh. Segment prompts by volatility: "high-priority/competitive" prompts run daily, "long-tail" prompts run weekly. This alone can cut run volume 60-70% with minimal accuracy loss — directly addresses the "actionability over completeness" principle.

### E. Context minimization
- Don't stuff huge context windows out of laziness. Retrieve only the relevant knowledge_chunks (via pgvector RAG) instead of pasting a brand's entire history into every prompt.
- Strip boilerplate, trim whitespace, avoid redundant instructions in system prompts — sounds trivial, adds up fast at scale.

### F. Use open-weight models via cheap hosted APIs where quality allows
DeepSeek, Qwen, and similar open-weight model families are now available through hosted API providers (DeepSeek's own API, OpenRouter, Together AI, Fireworks) at a fraction of GPT/Claude/Gemini pricing, with genuinely strong quality (see the DeepSeek-V4 benchmarks in Section 1 — it's competitive with frontier models on many tasks). For internal classification/extraction tasks (not the actual "what does the target engine say" tracking), route to these cheaper models.

### G. Only self-host + do speculative decoding (DeepSpec-style) once you have real scale
If, 12-18 months in, you're doing so much internal LLM inference (e.g., your own content-generation model, your own classification model) that API costs exceed the cost of renting GPUs and self-hosting, *then* revisit DeepSpec/speculative decoding to cut your self-hosted inference costs. This is a Phase 3-4 optimization, not a Phase 1 one.

### H. Real-time cost dashboarding (build this into your own product, not just your ops)
Since your schema already logs `tokens_used` and `cost_usd` per run (Part 2), build an internal cost-monitoring dashboard from day one so you know your gross margin per customer, per plan tier, before you scale pricing. This is a mistake several first-generation AEO tools have reportedly made — undercosting and then having to raise prices or restrict tiers later, damaging trust.

---

## 4. Multi-Engine Coverage Plan

| Engine | Priority | Access method |
|---|---|---|
| ChatGPT (consumer-facing behavior) | Must-have, Phase 1 | OpenAI API approximates but isn't identical to consumer ChatGPT behavior — most competitors acknowledge this gap; be transparent about it in your product rather than overclaiming precision |
| Perplexity | Must-have, Phase 1 | Perplexity API |
| Google AI Overviews / Gemini | Must-have, Phase 1 | Search result monitoring + Gemini API |
| Claude | Should-have, Phase 2 | Anthropic API |
| DeepSeek | Differentiator, Phase 2 | DeepSeek API (cheap, high quality, and matters more in Asian markets than in the US — genuine differentiation vs Western-first tools) |
| Grok, Qwen, regional models | Nice-to-have, Phase 3 | Add based on customer demand signals |

---

*Continue to Part 4: `04-feature-spec.md` for the full detailed feature specification, mapped against every competitor gap identified in the research.*
