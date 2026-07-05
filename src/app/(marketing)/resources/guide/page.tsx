import type { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";
import CTABanner from "@/components/shared/CTABanner";

export const metadata: Metadata = {
  title: "AEO Guide",
  description: "The core concepts of Answer Engine Optimization, explained plainly.",
  alternates: { canonical: "/resources/guide" },
};

const SECTIONS = [
  {
    title: "What is AEO?",
    body: "Answer Engine Optimization is the practice of structuring your brand's content, data, and technical setup so AI systems (ChatGPT, Perplexity, Gemini, Google AI Overviews) can reliably find, understand, and cite you when someone asks a relevant question. Where SEO optimizes for a ranked list of links, AEO optimizes for being the answer itself.",
  },
  {
    title: "Why it's different from SEO",
    body: "Traditional search returns ten blue links for a human to evaluate. An AI answer engine reads across many sources, synthesizes an answer, and often names only one or two brands. That means the competitive unit shifts from 'rank #1' to 'get mentioned at all' — a much higher bar, and a different kind of content and technical work.",
  },
  {
    title: "The four pillars",
    body: "1) Technical foundation — schema markup, crawlability for AI bots, clean structured data. 2) Content clarity — answer-first writing that directly addresses real questions, in the language your customers actually use. 3) Citation-worthy sources — being referenced by the third-party sites (review platforms, forums, directories) that AI engines already trust. 4) Measurement — tracking which prompts you win and lose, and why, so effort goes where it matters.",
  },
  {
    title: "Getting started, practically",
    body: "Start by listing the 20-30 real questions your customers are most likely to ask an AI assistant about your category. Check, manually or with a tool, whether you're mentioned today. For the gaps, look at what content or structured data the sites that ARE mentioned have that you don't — that comparison is usually the fastest path to your first fix.",
  },
  {
    title: "Common mistakes",
    body: "Treating AEO as 'SEO with AI added on' and skipping the technical schema work. Writing content that answers what you want to say rather than what customers actually ask. Machine-translating prompts into Hindi/regional languages instead of using how people genuinely phrase questions. And publishing large volumes of AI-generated content without human review — which risks both quality and search-engine penalties.",
  },
];

export default function GuidePage() {
  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-16 pt-36 md:pb-20 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">The Guide</p>
            <h1 className="mx-auto mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              AEO, from first principles.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-muted md:text-lg">
              No jargon, no fluff — just what Answer Engine Optimization actually is, and how to start doing it.
            </p>
          </div>
        </SectionWrapper>

        <SectionWrapper className="pb-24 md:pb-36">
          <div className="container-x mx-auto max-w-3xl space-y-14">
            {SECTIONS.map((s, i) => (
              <div key={s.title} className="flex gap-6">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-sm font-bold text-accent">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{s.title}</h2>
                  <p className="mt-3 text-[15px] leading-[1.8] text-muted">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionWrapper>

        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
