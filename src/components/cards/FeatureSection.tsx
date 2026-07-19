import Link from "next/link";
import { ArrowRight, Activity, Compass, LineChart, Sparkles } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const PILLARS = [
  {
    icon: Activity,
    eyebrow: "Monitor",
    title: "Know the moment AI talks about you.",
    desc: "AnsarAEO runs your category's real questions across every answer engine — in your customers' languages — and records whether AI names you, misses you, or cites a rival. Visibility, citations, and prompt coverage, watched continuously.",
    items: ["AI visibility & citation tracking", "Prompt monitoring across 6 engines", "AI index monitoring — llms.txt & schema"],
  },
  {
    icon: Compass,
    eyebrow: "Understand",
    title: "Know why AI trusts someone else.",
    desc: "When a competitor wins the mention, we show you the sources it cited and the words it used — then measure the gap between how you want to be seen and how AI actually sees you.",
    items: ["Competitor intelligence", "AI recommendation analysis", "Brand perception vs. positioning"],
  },
  {
    icon: Sparkles,
    eyebrow: "Improve",
    title: "Become the answer, not the afterthought.",
    desc: "Turn insight into action. AnsarAEO drafts the schema, llms.txt, and content that earn the citation — and ships it to your CMS in one click. No new writer, no agency retainer.",
    items: ["Content optimization", "GEO & technical audits", "One-click AI index generation"],
  },
  {
    icon: LineChart,
    eyebrow: "Measure",
    title: "Tie AI visibility to revenue.",
    desc: "Watch share of voice and mention rate climb over time — and connect AI discovery to the sessions, orders, and revenue it actually drives.",
    items: ["Analytics & reporting", "Revenue attribution", "Share-of-voice trends"],
  },
];

export default function FeatureSection() {
  return (
    <SectionWrapper id="features" className="py-24 md:py-40">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">What AnsarAEO does</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            Four moves, from invisible to recommended.
          </h2>
          <p className="mt-5 max-w-xl text-muted md:text-lg">
            Monitor what AI says about you. Understand why it chooses rivals. Improve the answer. Measure the
            impact — in Hindi, Hinglish, Tamil, Bengali and Marathi, the way your customers actually ask.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-6xl gap-6 md:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.eyebrow} className="card p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{p.eyebrow}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.desc}</p>
              <ul className="mt-6 space-y-2.5">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2.5 text-sm text-ink/80">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/signup" className="btn-secondary">
            Explore the platform <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </SectionWrapper>
  );
}
