"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: "easeOut" as const },
});

const ENGINES = ["ChatGPT", "Gemini", "Perplexity", "Google AI Overviews", "Grok", "Copilot"];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-36 md:pb-32 md:pt-44">
      <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      <div aria-hidden className="absolute -top-48 left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-accent/5 blur-3xl" />
      <div className="container-x relative text-center">
        <motion.p
          {...fadeUp(0)}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1.5 text-xs font-medium text-muted shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
          AI Brand Intelligence Platform
        </motion.p>
        <motion.h1 {...fadeUp(0.1)} className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          Be the answer
          <br />
          AI recommends.
        </motion.h1>
        <motion.p {...fadeUp(0.2)} className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          AnsarAEO helps Indian brands become the answer AI recommends. We track your visibility across
          ChatGPT, Gemini, Perplexity, Google AI Overviews, Grok and Copilot, explain why competitors win the
          mention instead, and draft the exact fixes that win it back.
        </motion.p>
        <motion.div {...fadeUp(0.3)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="btn-primary">
            Start Free <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="#how" className="btn-secondary">
            See how it works
          </Link>
        </motion.div>
        <motion.p {...fadeUp(0.4)} className="mt-6 text-xs font-medium tracking-wide text-muted">
          Free 14-day trial · No card required · Cancel in one click
        </motion.p>
        <motion.div {...fadeUp(0.5)} className="mt-14">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Tracked across</p>
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-semibold text-ink/70">
            {ENGINES.map((e, i) => (
              <span key={e} className="inline-flex items-center gap-3">
                {e}
                {i < ENGINES.length - 1 && <span className="text-line">·</span>}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
