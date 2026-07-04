import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/navigation/Navbar";
import SectionWrapper from "@/components/layout/SectionWrapper";
import DashboardPreview from "@/components/dashboard/DashboardPreview";
import FeatureDirectory from "@/components/shared/FeatureDirectory";
import CustomerSuccess from "@/components/testimonials/CustomerSuccess";
import ComparisonTable from "@/components/tables/ComparisonTable";
import FaqSplit from "@/components/faq/FaqSplit";
import TestimonialGrid from "@/components/testimonials/TestimonialGrid";
import CTABanner from "@/components/shared/CTABanner";
import Footer from "@/components/footer/Footer";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Prompt tracking, Hindi & Hinglish coverage, Auto-Fix deployment, revenue attribution and agency tools — every AnsarAEO feature explained.",
  alternates: { canonical: "/product" },
};

export default function ProductPage() {
  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-20 pt-36 md:pb-28 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Platform</p>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              The full toolkit for winning AI answers.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-muted md:text-lg">
              From nightly prompt runs to one-click fixes — everything an Indian brand or agency needs to own AI search.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-primary">
                Start Free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="#directory" className="btn-secondary">
                Browse features
              </Link>
            </div>
            <div className="mt-16 md:mt-20">
              <DashboardPreview />
            </div>
          </div>
        </SectionWrapper>
        <FeatureDirectory />
        <CustomerSuccess />
        <ComparisonTable />
        <FaqSplit />
        <TestimonialGrid />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
