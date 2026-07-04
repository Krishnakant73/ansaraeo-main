import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/navigation/Navbar";
import SectionWrapper from "@/components/layout/SectionWrapper";
import DashboardPreview from "@/components/dashboard/DashboardPreview";
import LogoCloud from "@/components/shared/LogoCloud";
import BenefitsGrid from "@/components/cards/BenefitsGrid";
import FeatureMatrix from "@/components/cards/FeatureMatrix";
import Timeline from "@/components/shared/Timeline";
import ComparisonTable from "@/components/tables/ComparisonTable";
import TestimonialGrid from "@/components/testimonials/TestimonialGrid";
import FaqSplit from "@/components/faq/FaqSplit";
import CTABanner from "@/components/shared/CTABanner";
import Footer from "@/components/footer/Footer";

export const metadata: Metadata = {
  title: "For Agencies",
  description:
    "Multi-client AEO workspaces, white-label reports and pitch-mode audits — turn AI search visibility into a retainer line for your agency.",
  alternates: { canonical: "/agency" },
};

export default function AgencyPage() {
  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-20 pt-36 md:pb-28 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">For Agencies</p>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              The AEO platform your retainers deserve.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-muted md:text-lg">
              Manage every client’s AI visibility from one workspace — pitch with audits, report with your logo, and
              bill it as a retainer.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-primary">
                Start Free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/pricing" className="btn-secondary">
                See agency pricing
              </Link>
            </div>
            <div className="mt-16 md:mt-20">
              <DashboardPreview />
            </div>
          </div>
        </SectionWrapper>
        <LogoCloud />
        <BenefitsGrid />
        <FeatureMatrix />
        <Timeline />
        <ComparisonTable />
        <TestimonialGrid />
        <FaqSplit />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
