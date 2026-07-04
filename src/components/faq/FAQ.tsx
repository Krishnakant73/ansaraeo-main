"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    q: "What exactly does AnsarAEO track?",
    a: "We run your prompts daily across ChatGPT, Perplexity and Gemini, then record whether your brand is mentioned, in what position, with what sentiment, and which sources get cited — all trended over time.",
  },
  {
    q: "Do you really support Hindi and Hinglish?",
    a: "Yes. Prompts are written and evaluated natively in Hindi, Hinglish, Tamil, Bengali and Marathi — not machine-translated English. It is how your customers actually ask AI.",
  },
  {
    q: "How much does it cost?",
    a: "SMB plans start at ₹1,999/mo with real value — 25-50 prompts, 3 engines and weekly reports. Agency plans add white-label reports and multi-client workspaces.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, with one click from Billing. Cancellation is immediate, proration is clear, and your card is removed on request. No dark patterns.",
  },
  {
    q: "How fresh is the data?",
    a: "Every number carries a freshness timestamp like 'last checked 6 hours ago'. Scores come from live model queries, not stale cached data.",
  },
  {
    q: "Does it fit my existing stack?",
    a: "Native integrations for Shopify, WordPress, WooCommerce, GA4 and Razorpay, plus WhatsApp and Slack alerts for visibility drops.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SectionWrapper id="faq" className="py-24 md:py-36">
      <div className="container-x mx-auto max-w-3xl">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-5xl">Questions, answered.</h2>
        <div className="mt-12 space-y-3">
          {ITEMS.map((item, i) => (
            <div key={item.q} className="rounded-[20px] border border-line bg-white transition-shadow duration-300 hover:shadow-card">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-sm font-semibold md:text-base"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
              >
                {item.q}
                <Plus
                  className={cn("h-4 w-4 shrink-0 text-accent transition-transform duration-300", open === i && "rotate-45")}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    id={`faq-panel-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
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
