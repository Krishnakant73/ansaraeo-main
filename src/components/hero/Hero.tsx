"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import DashboardPreview from "@/components/dashboard/DashboardPreview";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: "easeOut" as const },
});

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
          India-first AI search visibility
        </motion.p>
        <motion.h1 {...fadeUp(0.1)} className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          Be the answer
          <br />
          AI gives your customers.
        </motion.h1>
        <motion.p {...fadeUp(0.2)} className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          AnsarAEO tracks how ChatGPT, Perplexity and Gemini talk about your brand — in English, Hindi and Hinglish — then
          drafts the exact fixes that win you the mention.
        </motion.p>
        <motion.div {...fadeUp(0.3)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="btn-primary">
            Start Free <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="#features" className="btn-secondary">
            Book Demo
          </Link>
        </motion.div>
        <motion.p {...fadeUp(0.4)} className="mt-6 text-xs font-medium tracking-wide text-muted">
          Free 14-day trial · No card required · Cancel in one click
        </motion.p>
        <motion.div {...fadeUp(0.5)} className="relative mt-16 md:mt-20">
          <DashboardPreview />
        </motion.div>
      </div>
    </section>
  );
}
