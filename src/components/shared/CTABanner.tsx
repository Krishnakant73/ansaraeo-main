import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

export default function CTABanner() {
  return (
    <SectionWrapper className="py-12 md:py-16">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-[28px] bg-ink px-8 py-16 text-center md:px-16 md:py-24">
          <div aria-hidden className="absolute inset-0 bg-dots-dark" />
          <div aria-hidden className="absolute -top-32 left-1/2 h-64 w-[480px] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
              Your customers already ask AI. Make sure it answers with <span className="text-accent-hover">you</span>.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/60 md:text-lg">
              Set up in 10 minutes. First visibility report in your inbox tonight.
            </p>
            <Link href="/signup" className="btn-primary mt-9">
              Start Free <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
