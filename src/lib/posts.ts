import type { Post } from "@/types";

export const CATEGORIES = ["All", "SEO", "AI", "Engineering", "Product", "Marketing", "Case Studies", "News"];

export const POSTS: Post[] = [
  {
    slug: "aeo-guide-2026",
    title: "The 2026 guide to AEO for Indian brands",
    excerpt: "Answer Engine Optimization is replacing the first page of Google. The complete playbook for winning AI answers in India.",
    category: "AI",
    author: "Kavya Rao",
    initials: "KR",
    date: "Jun 28, 2026",
    readTime: "12 min",
    featured: true,
    thumb: "from-orange-100 via-amber-50 to-white",
  },
  {
    slug: "lumora-hindi-prompts",
    title: "How Lumora won 7 Hindi money prompts in 60 days",
    excerpt: "A D2C skincare brand went from invisible to ChatGPT's top recommendation — in the language its customers actually use.",
    category: "Case Studies",
    author: "Dev Malhotra",
    initials: "DM",
    date: "Jun 21, 2026",
    readTime: "8 min",
    featured: true,
    thumb: "from-stone-100 via-orange-50 to-white",
  },
  { slug: "llms-txt-explained", title: "llms.txt, explained in plain English", excerpt: "What the new crawler standard means for your site, and how to ship one in ten minutes.", category: "SEO", author: "Kavya Rao", initials: "KR", date: "Jun 14, 2026", readTime: "6 min", thumb: "from-amber-50 to-white" },
  { slug: "hinglish-prompts-chatgpt", title: "Why Hinglish prompts behave differently in ChatGPT", excerpt: "Machine-translated prompts miss how India actually asks. What our native-language runs reveal.", category: "AI", author: "Ishaan Verma", initials: "IV", date: "Jun 7, 2026", readTime: "9 min", thumb: "from-orange-50 to-white" },
  { slug: "nightly-visibility-pipeline", title: "Inside our nightly visibility pipeline", excerpt: "Batch APIs, deduplication and cost ceilings: how 12,000 prompts run every night without melting the budget.", category: "Engineering", author: "Dev Malhotra", initials: "DM", date: "May 30, 2026", readTime: "11 min", thumb: "from-stone-100 to-white" },
  { slug: "introducing-auto-fix", title: "Introducing Auto-Fix: from gap to deploy in one click", excerpt: "We stopped telling you what to fix and started fixing it. Schema, content and CMS pushes, reviewed by you.", category: "Product", author: "Kavya Rao", initials: "KR", date: "May 22, 2026", readTime: "5 min", thumb: "from-orange-100 to-white" },
  { slug: "cfo-ready-aeo-reports", title: "AEO reporting your CFO will actually read", excerpt: "Visibility scores don't unlock budget. Revenue attribution does. A template that works.", category: "Marketing", author: "Ishaan Verma", initials: "IV", date: "May 15, 2026", readTime: "7 min", thumb: "from-amber-50 via-orange-50 to-white" },
  { slug: "meridian-white-label", title: "How Meridian pitches with white-label audits", excerpt: "One agency's playbook for turning free visibility audits into 12 signed retainers.", category: "Case Studies", author: "Dev Malhotra", initials: "DM", date: "May 8, 2026", readTime: "8 min", thumb: "from-stone-100 via-amber-50 to-white" },
  { slug: "gemini-shopping-answers", title: "Gemini's new shopping answers: what changed", excerpt: "Google's AI shopping surfaces are rolling out in India. Here's what we're seeing in the data.", category: "News", author: "Kavya Rao", initials: "KR", date: "May 1, 2026", readTime: "4 min", thumb: "from-orange-50 via-white to-white" },
  { slug: "faq-schema-citations", title: "FAQ schema that actually gets cited", excerpt: "Most FAQ markup is ignored by answer engines. The patterns that earn citations, with examples.", category: "SEO", author: "Ishaan Verma", initials: "IV", date: "Apr 24, 2026", readTime: "6 min", thumb: "from-amber-100 to-white" },
  { slug: "grounded-agent-rag", title: "Grounding an agent in your own visibility data", excerpt: "How we built a chat agent that cites your prompt runs instead of hallucinating advice.", category: "Engineering", author: "Dev Malhotra", initials: "DM", date: "Apr 17, 2026", readTime: "10 min", thumb: "from-stone-50 via-orange-50 to-white" },
];
