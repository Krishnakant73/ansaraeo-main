"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Tracking", "Languages", "Automation", "Reporting", "Agency", "Integrations"];

const FEATURES = [
  { title: "Daily prompt tracking", category: "Tracking", desc: "Your prompts run every night across ChatGPT, Perplexity and Gemini, with mention, position and sentiment recorded per engine." },
  { title: "Visibility score", category: "Tracking", desc: "A 0-100 composite score per brand, trended over time, always paired with a plain-English explanation of what moved it." },
  { title: "Share of voice", category: "Tracking", desc: "The percentage of tracked prompts where you appear versus named competitors, per engine and per language." },
  { title: "Hindi & Hinglish prompts", category: "Languages", desc: "Prompts written and evaluated natively in Hindi, Hinglish, Tamil, Bengali and Marathi — never machine-translated English." },
  { title: "Auto-Fix deployment", category: "Automation", desc: "When a gap is found, we draft the schema markup or content and push it to WordPress or Shopify in one click." },
  { title: "Structured data generator", category: "Automation", desc: "FAQ, Product and Organization schema generated automatically, ready to paste or deploy." },
  { title: "Weekly reports", category: "Reporting", desc: "A digest of your top 5 opportunities and visibility trend, delivered by email every week." },
  { title: "Revenue attribution", category: "Reporting", desc: "AI search to sessions to orders to revenue in one native view, powered by GA4, Shopify and Razorpay." },
  { title: "White-label reports", category: "Agency", desc: "Branded PDF reports and pitch-mode audits for prospects, built for multi-client agency workflows." },
  { title: "WhatsApp & Slack alerts", category: "Integrations", desc: "Real-time alerts when your visibility drops, delivered where your team actually works." },
];

export default function FeatureDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [open, setOpen] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      FEATURES.filter(
        (f) =>
          (category === "All" || f.category === category) &&
          (f.title + f.desc).toLowerCase().includes(query.toLowerCase())
      ),
    [query, category]
  );

  return (
    <section id="directory" className="bg-[#161616] py-24 text-white md:py-36">
      <div className="container-x">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-[42px] md:leading-tight">
          Every feature, in one place.
        </h2>
        <div className="mx-auto mt-10 max-w-2xl">
          <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3.5 transition-colors focus-within:border-accent">
            <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search features…"
              aria-label="Search features"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200",
                  category === c
                    ? "border-accent bg-accent text-white"
                    : "border-white/15 text-white/60 hover:border-white/40 hover:text-white"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-3xl">
          {filtered.map((f, i) => (
            <div key={f.title} className="border-b border-white/10 first:border-t">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`feature-panel-${i}`}
                className="flex min-h-[68px] w-full items-center justify-between gap-4 px-2 py-5 text-left transition-colors hover:bg-white/5"
              >
                <span className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold">{f.title}</span>
                  <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                    {f.category}
                  </span>
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-accent transition-transform duration-300", open === i && "rotate-180")}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    id={`feature-panel-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-2 pb-6 text-sm leading-[1.7] text-white/60">{f.desc}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-white/50">No features match your search.</p>
          )}
        </div>
      </div>
    </section>
  );
}
