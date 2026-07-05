import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";
import { POSTS } from "@/lib/posts";

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/resources/blog/${post.slug}` },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) notFound();

  const related = POSTS.filter((p) => p.category === post.category && p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="pb-16 pt-36 md:pt-44">
          <div className="container-x mx-auto max-w-2xl">
            <Link href="/resources/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> Back to blog
            </Link>

            <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-accent">{post.category}</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{post.title}</h1>

            <div className="mt-6 flex items-center gap-3 text-sm text-muted">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-xs font-bold text-white">
                {post.initials}
              </span>
              {post.author} · {post.date} · {post.readTime}
            </div>

            <div className={`mt-8 h-48 w-full rounded-2xl bg-gradient-to-br ${post.thumb}`} />

            <article className="prose prose-sm mt-10 max-w-none">
              {post.content.map((paragraph, i) => (
                <p key={i} className="text-[15px] leading-[1.8] text-ink/80">
                  {paragraph}
                </p>
              ))}
            </article>
          </div>
        </SectionWrapper>

        {related.length > 0 && (
          <SectionWrapper className="bg-surface py-20 md:py-28">
            <div className="container-x mx-auto max-w-4xl">
              <h2 className="text-xl font-bold tracking-tight">More in {post.category}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {related.map((r) => (
                  <Link key={r.slug} href={`/resources/blog/${r.slug}`} className="card p-6">
                    <h3 className="text-sm font-bold leading-snug tracking-tight">{r.title}</h3>
                    <p className="mt-2 line-clamp-2 text-xs text-muted">{r.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </SectionWrapper>
        )}
      </main>
      <Footer />
    </>
  );
}
