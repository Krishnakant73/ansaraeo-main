import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const STUDIES = [
  {
    metric: "+303%",
    title: "Lumora Skincare tripled AI visibility in 90 days",
    desc: "From invisible to ChatGPT's top recommendation for 7 Hindi money prompts.",
  },
  {
    metric: "12 clients",
    title: "Meridian Digital built an AEO retainer practice",
    desc: "White-label reports turned AI visibility into a recurring revenue line.",
  },
];

export default function CaseStudies() {
  return (
    <SectionWrapper className="bg-surface py-24 md:py-32">
      <div className="container-x">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-5xl">Priced to pay for itself.</h2>
        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
          {STUDIES.map((s) => (
            <Link key={s.title} href="/blog" className="card group flex h-full flex-col p-8 md:p-10">
              <p className="text-5xl font-extrabold tracking-tight text-accent">{s.metric}</p>
              <h3 className="mt-5 text-[22px] font-bold leading-snug tracking-tight transition-colors group-hover:text-accent">{s.title}</h3>
              <p className="mt-3 text-sm leading-[1.7] text-muted">{s.desc}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                Read the story
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
