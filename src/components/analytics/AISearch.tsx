"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Search, Sparkles } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const QUERIES = [
  "Why did our visibility drop this week?",
  "Which prompts are we losing to competitors?",
  "Draft a brief for our weakest Hindi prompt.",
];

const SUGGESTIONS = [
  "Top 5 opportunities this week",
  "Compare us vs. Competitor A on Perplexity",
  "Show prompts where we lost citations",
];

export default function AISearch() {
  const [qi, setQi] = useState(0);
  const [text, setText] = useState("");

  useEffect(() => {
    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const q = QUERIES[qi];
    const interval = setInterval(() => {
      i += 1;
      setText(q.slice(0, i));
      if (i >= q.length) {
        clearInterval(interval);
        timeout = setTimeout(() => {
          setText("");
          setQi((prev) => (prev + 1) % QUERIES.length);
        }, 2200);
      }
    }, 45);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [qi]);

  return (
    <SectionWrapper id="agent" className="py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">The Agent</p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Ask your visibility data anything.</h2>
          <p className="mt-5 text-muted md:text-lg">
            A conversational agent grounded in your own prompt runs and citations — never a vague, generic answer.
          </p>
        </div>
        <div className="mx-auto mt-14 max-w-2xl">
          <div className="card flex items-center gap-3 !rounded-full px-6 py-4 hover:!translate-y-0 hover:!scale-100">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <p className="min-h-[1.5rem] flex-1 text-left text-sm md:text-base" aria-live="polite">
              {text}
              <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-accent align-middle" aria-hidden />
            </p>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-white">
              <Bot className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.12, duration: 0.5 }}
                className="rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink"
              >
                <Sparkles className="mr-1.5 inline h-3 w-3 text-accent" aria-hidden />
                {s}
              </motion.button>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="card mt-6 p-6 text-left hover:!translate-y-0 hover:!scale-100"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Agent answer</p>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              Your visibility dropped 6 points this week, mainly on Perplexity. Two review sites that previously cited
              you updated their pages. Based on 14 runs across ChatGPT and Perplexity — I have drafted a refreshed
              comparison page to recover both citations.
            </p>
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}
