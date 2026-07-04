import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

export default function FinalCTA() {
  return (
    <SectionWrapper className="relative overflow-hidden py-28 md:py-44">
      <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-72 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
      <div className="container-x relative text-center">
        <h2 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
          Own the answer, before your competitor does.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-muted md:text-lg">
          Join 300+ Indian brands and agencies already winning AI search. Set up in minutes.
        </p>
        <div className="mt-10 flex justify-center">
          <Link href="/signup" className="btn-primary !h-14 !px-10 !text-base">
            Start Free <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted">14-day free trial · ₹1,999/mo after · Cancel in one click</p>
      </div>
    </SectionWrapper>
  );
}
