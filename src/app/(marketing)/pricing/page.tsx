import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navigation/Navbar";
import SectionWrapper from "@/components/layout/SectionWrapper";
import PricingCards from "@/components/pricing/PricingCards";
import PlanComparison from "@/components/pricing/PlanComparison";
import CaseStudies from "@/components/pricing/CaseStudies";
import FAQ from "@/components/faq/FAQ";
import Footer from "@/components/footer/Footer";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AEO plans priced for Indian brands and agencies — from ₹1,999/mo. 14-day free trial, no card required, one-click cancel.",
  alternates: { canonical: "/pricing" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "AnsarAEO",
  description: "AI search visibility platform for Indian brands and agencies.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "INR",
    lowPrice: "1999",
    highPrice: "29999",
    offerCount: "6",
  },
};

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-4 pt-36 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative text-center">
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Pricing that fits Indian budgets.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-muted md:text-lg">
              Real value at every tier — no crippled teaser plans. Cancel in one click, anytime.
            </p>
          </div>
        </SectionWrapper>
        <PricingCards />
        <SectionWrapper className="py-12">
          <div className="container-x">
            <div className="relative overflow-hidden rounded-[28px] bg-ink px-8 py-12 md:px-14 md:py-14">
              <div aria-hidden className="absolute inset-0 bg-dots-dark" />
              <div className="relative flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">Enterprise &amp; marketplaces</h2>
                  <p className="mt-2 max-w-lg text-white/60">
                    Custom engines, SSO, DPAs, and Amazon.in / Flipkart AI shopping visibility. Priced for your scale.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                  <Link href="/enterprise" className="btn-primary">
                    Explore Enterprise
                  </Link>
                  <Link
                    href="/#footer"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 px-7 text-sm font-medium text-white transition-colors hover:border-white/50"
                  >
                    Talk to sales
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </SectionWrapper>
        <PlanComparison />
        <CaseStudies />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
