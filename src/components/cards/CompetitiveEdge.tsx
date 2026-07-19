import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

export default function CompetitiveEdge() {
  return (
    <SectionWrapper className="bg-surface py-24 md:py-36">
      <div className="container-x">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <p className="section-label text-accent">Why we&apos;re different</p>
            <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
              We don&apos;t just show you the score. We show you why you lost.
            </h2>
            <p className="mt-5 text-muted md:text-lg">
              Most tools stop at a chart. AnsarAEO opens the black box: the exact sources AI cites for a
              rival, the wording it uses to describe them, and the gap between how you want to be seen and how
              you actually are.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Competitor citations — the domains AI trusts instead of you.",
                "Perception gaps — where AI's view of you diverges from your positioning.",
                "One-click fixes — drafts that close the gap, in your customers' language.",
              ].map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-relaxed text-ink/80">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn-secondary mt-10">
              Flip the advantage <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="relative">
            <div className="card overflow-hidden p-2">
              <div className="rounded-[16px] bg-surface/70 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Prompt</p>
                <p className="mt-2 text-sm font-medium text-ink">
                  &ldquo;best d2c skincare brand in India&rdquo;
                </p>
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-line bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink/60">Competitor A</span>
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink/60">
                        Recommended
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      Cited by 3 sources · described as &ldquo;clean, affordable, dermatologist-backed&rdquo;
                    </p>
                  </div>
                  <div className="rounded-xl border border-accent/30 bg-accent/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-accent">Your brand</span>
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        Not mentioned
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      Fix drafted: add FAQ schema + 2 founder citations to /pricing
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
