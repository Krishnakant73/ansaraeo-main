import type { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";
import BlogList from "@/components/resources/BlogList";

export const metadata: Metadata = {
  title: "Blog",
  description: "AEO strategy, case studies, and product updates from AnsarAEO.",
  alternates: { canonical: "/resources/blog" },
};

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-16 pt-36 md:pb-20 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Blog</p>
            <h1 className="mx-auto mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              AEO, in plain English.
            </h1>
          </div>
        </SectionWrapper>
        <SectionWrapper className="pb-24 md:pb-36">
          <div className="container-x mx-auto max-w-5xl">
            <BlogList />
          </div>
        </SectionWrapper>
      </main>
      <Footer />
    </>
  );
}
