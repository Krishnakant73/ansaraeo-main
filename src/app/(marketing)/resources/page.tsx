import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Code2, FileText, Sparkles } from "lucide-react";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";
import { POSTS } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Resources",
  description: "Blog, AEO guide, documentation, and changelog for AnsarAEO.",
  alternates: { canonical: "/resources" },
};

const SECTIONS = [
  {
    icon: BookOpen,
    title: "Blog",
    desc: "AEO strategy, case studies, and product updates.",
    href: "/resources/blog",
  },
  {
    icon: Sparkles,
    title: "AEO Guide",
    desc: "The core concepts of Answer Engine Optimization, explained plainly.",
    href: "/resources/guide",
  },
  {
    icon: Code2,
    title: "Docs",
    desc: "How to set up your account, track prompts, and use the API.",
    href: "/resources/docs",
  },
  {
    icon: FileText,
    title: "Changelog",
    desc: "What shipped, and when — built in public.",
    href: "/resources/changelog",
  },
];

export default function ResourcesPage() {
  const latestPosts = POSTS.slice(0, 3);

  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-16 pt-36 md:pb-20 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Resources</p>
            <h1 className="mx-auto mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              Learn AEO. Watch us build.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-muted md:text-lg">
              Guides, docs, and an honest changelog — everything we publish here follows the same rule the product
              does: AI-assisted, human-reviewed, never generic filler.
            </p>
          </div>
        </SectionWrapper>

        <SectionWrapper className="pb-20 md:pb-28">
          <div className="container-x mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <Link key={s.title} href={s.href} className="card group flex flex-col p-7">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-5 text-lg font-bold tracking-tight">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.desc}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </SectionWrapper>

        <SectionWrapper className="bg-surface pb-24 pt-4 md:pb-36">
          <div className="container-x mx-auto max-w-4xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Latest from the blog</h2>
              <Link href="/resources/blog" className="text-sm font-medium text-accent">
                View all
              </Link>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {latestPosts.map((post) => (
                <Link key={post.slug} href={`/resources/blog/${post.slug}`} className="card group flex flex-col p-6">
                  <div className={`h-24 w-full rounded-xl bg-gradient-to-br ${post.thumb}`} />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-accent">{post.category}</p>
                  <h3 className="mt-1.5 text-base font-bold leading-snug tracking-tight group-hover:text-accent">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{post.excerpt}</p>
                  <p className="mt-4 text-xs text-muted">{post.date} · {post.readTime}</p>
                </Link>
              ))}
            </div>
          </div>
        </SectionWrapper>
      </main>
      <Footer />
    </>
  );
}
