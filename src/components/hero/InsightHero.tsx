"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import posthog from "posthog-js";

// ============================================================
// InsightHero — replaces the classic marketing hero.
//
// The whole above-the-fold is ONE input, autofocused. Submitting posts
// to /api/analyze and routes the user to /analyze/[scanId] where they
// watch the streaming scan. No signup wall — value first.
//
// Design principle: the promise underneath ("60 seconds, no signup")
// is not marketing puffery — it's the actual, tested TTV. If we can't
// deliver in ~60s, we shouldn't say we can.
// ============================================================

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: "easeOut" as const },
});

export default function InsightHero() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      const data = (await res.json()) as { scanId?: string; error?: string; cached?: boolean };
      if (!res.ok || !data.scanId) {
        setError(data.error ?? "Something went wrong. Try again.");
        setLoading(false);
        return;
      }
      posthog.capture("scan_submitted", {
        domain: domain.trim(),
        cached: data.cached ?? false,
      });
      router.push(`/analyze/${data.scanId}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden pb-20 pt-32 md:pb-28 md:pt-40">
      <div
        aria-hidden
        className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="absolute -top-48 left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-accent/5 blur-3xl"
      />
      <div className="container-x relative text-center">
        <motion.p
          {...fadeUp(0)}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1.5 text-xs font-medium text-muted shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
          Live scan · ChatGPT · Perplexity · Gemini
        </motion.p>

        <motion.h1
          {...fadeUp(0.1)}
          className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl"
        >
          See if AI recommends
          <br />
          your brand.
        </motion.h1>

        <motion.p
          {...fadeUp(0.2)}
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg"
        >
          60 seconds. No signup. We run real queries against ChatGPT, Perplexity, and Gemini and
          show you where you're mentioned — and where your competitors are winning instead.
        </motion.p>

        <motion.form
          {...fadeUp(0.3)}
          onSubmit={handleSubmit}
          className="mx-auto mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="analyze-domain" className="sr-only">
            Your brand's website
          </label>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="analyze-domain"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                if (error) setError(null);
              }}
              disabled={loading}
              placeholder="yourbrand.com"
              className="h-14 w-full rounded-2xl border border-line bg-white px-5 text-base font-medium text-ink shadow-sm outline-none transition-colors focus:border-accent disabled:opacity-60"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "analyze-error" : undefined}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !domain.trim()}
            className="btn-primary !h-14 !px-6 disabled:opacity-60"
          >
            {loading ? "Starting…" : "Analyze"}
            {!loading && <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>
        </motion.form>

        {error && (
          <p id="analyze-error" className="mx-auto mt-3 max-w-xl text-sm text-red-500">
            {error}
          </p>
        )}

        <motion.p {...fadeUp(0.4)} className="mt-4 text-xs font-medium tracking-wide text-muted">
          Free scan · No card · Signup only when you want to save your report
        </motion.p>

        <motion.div {...fadeUp(0.55)} className="mt-16 flex flex-col items-center gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Or explore Enterprise
          </p>
          <Link
            href="/enterprise"
            className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            Managing 5+ brands? Talk to us →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
