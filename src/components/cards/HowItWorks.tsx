import Link from "next/link";
import { ArrowRight, Radar, ScanSearch, Wand2 } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const STEPS = [
  {
    icon: Radar,
    step: "01",
    title: "Monitor",
    desc: "We run your category's real questions across ChatGPT, Gemini, Perplexity, Google AI Overviews, Grok and Copilot — in your customers' languages — and record whether AI names you.",
  },
  {
    icon: ScanSearch,
    step: "02",
    title: "Understand",
    desc: "We show you why a competitor won the mention: the sources it cited, the words it used, and the gap between your positioning and AI's perception of you.",
  },
  {
    icon: Wand2,
    step: "03",
    title: "Improve",
    desc: "We draft the fix — schema, llms.txt, content — and you push it live in one click. The next run moves in your favour.",
  },
];

export default function HowItWorks() {
  return (
    <SectionWrapper id="how" className="py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label text-accent">How it works</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            From invisible to recommended in three steps.
          </h2>
          <p className="mt-5 text-muted md:text-lg">
            No new headcount, no SEO guesswork. AnsarAEO runs the loop for you — every day — and shows you the
            impact in the numbers that matter.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.step} className="relative card p-8">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-bold tracking-widest text-ink/15">{s.step}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/signup" className="btn-primary">
            Start tracking free <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </SectionWrapper>
  );
}
