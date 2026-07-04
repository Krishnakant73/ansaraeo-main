"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";
import { cn } from "@/lib/utils";

const ITEMS = [
  { q: "Which engines do you cover?", a: "ChatGPT, Perplexity and Gemini today, with Claude, Grok and India-relevant models like DeepSeek on the roadmap." },
  { q: "How many prompts can I track?", a: "25-50 on SMB plans, scaling to thousands on agency and enterprise plans. You can swap prompts anytime." },
  { q: "Can my agency manage multiple clients?", a: "Yes — multi-client workspaces, role-based permissions and white-label PDF reports are built in." },
  { q: "Does Auto-Fix publish without my approval?", a: "Never. Every AI draft is labelled and requires explicit human review before anything is deployed." },
  { q: "Is there an API?", a: "A read API for visibility data ships with V1, so you can pipe scores into your own dashboards." },
];

export default function FaqSplit() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SectionWrapper className="py-24 md:py-36">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr,1.4fr]">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-[42px] md:leading-tight">Frequently asked questions</h2>
          <p className="mt-5 max-w-sm text-muted md:text-lg">Everything about coverage, plans and how the platform works.</p>
        </div>
        <div className="space-y-3">
          {ITEMS.map((item, i) => (
            <div key={item.q} className="rounded-[20px] border border-line bg-white transition-shadow duration-300 hover:shadow-card">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`ffaq-panel-${i}`}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-sm font-semibold md:text-base"
              >
                {item.q}
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-accent transition-transform duration-300", open === i && "rotate-180")}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    id={`ffaq-panel-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm leading-[1.7] text-muted">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
