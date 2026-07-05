import type { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";
import CTABanner from "@/components/shared/CTABanner";

export const metadata: Metadata = {
  title: "About Us",
  description: "Why we built AnsarAEO — India-first AI search visibility for brands and agencies.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-16 pt-36 md:pb-24 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">About Us</p>
            <h1 className="mx-auto mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              Built in India, for how India actually searches.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-muted md:text-lg">
              ChatGPT, Perplexity, and Gemini are becoming the new front page for millions of Indian buyers — and
              they ask in Hindi, Hinglish, and regional languages, not just English. We built AnsarAEO because no
              global tool was built for that reality.
            </p>
          </div>
        </SectionWrapper>

        <SectionWrapper className="bg-surface py-20 md:py-28">
          <div className="container-x mx-auto grid max-w-4xl gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Our mission</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Make sure every Indian brand and agency can see, understand, and win how AI assistants talk about
                them — in the languages their actual customers use, at a price that makes sense for an Indian
                business, not a Silicon Valley budget.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Why it matters now</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Search is fragmenting. A growing share of buying decisions start with a question typed into an AI
                assistant, not a Google search bar. Brands that are invisible in those answers are invisible to
                the customer at the exact moment they're deciding what to buy.
              </p>
            </div>
          </div>
        </SectionWrapper>

        <SectionWrapper className="py-20 md:py-28">
          <div className="container-x mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">What we stand for</h2>
            <div className="mt-10 grid gap-6 text-left sm:grid-cols-3">
              <div className="card p-6">
                <h3 className="font-semibold">Transparent billing</h3>
                <p className="mt-2 text-sm text-muted">One-click cancel, no dark patterns, ever.</p>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold">Human-reviewed AI</h3>
                <p className="mt-2 text-sm text-muted">
                  Every AI draft is labeled and requires your review before it goes live.
                </p>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold">India-first, not India-later</h3>
                <p className="mt-2 text-sm text-muted">
                  Hindi and regional-language support from day one, not a future roadmap item.
                </p>
              </div>
            </div>
          </div>
        </SectionWrapper>

        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
