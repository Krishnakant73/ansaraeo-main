import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const PAINS = [
  {
    title: "The answer is now one brand.",
    desc: "When someone asks an AI for the best in your category, it names one or two. If it's not you, the sale never starts — and you never know.",
  },
  {
    title: "You can't see why you lost.",
    desc: "A rival gets the citation while legacy SEO shows you rankings for a search page nobody opens anymore.",
  },
  {
    title: "Every silent answer is demand lost.",
    desc: "Each AI response that omits you hands that buyer to a competitor. Guesswork won't win them back.",
  },
];

export default function ProblemStatement() {
  return (
    <SectionWrapper className="bg-surface py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label text-accent">The shift</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            Your next customer won&rsquo;t search. They&rsquo;ll ask an AI.
          </h2>
          <p className="mt-5 text-muted md:text-lg">
            Discovery has moved from a list of links to a single recommended answer. The brands AI trusts get
            the click, the call, the order. The ones it forgets don&rsquo;t even make the shortlist.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.title} className="rounded-[20px] border border-line bg-white p-7 shadow-card">
              <h3 className="text-lg font-bold tracking-tight">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="#how" className="btn-secondary">
            See how AnsarAEO wins the mention <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </SectionWrapper>
  );
}
