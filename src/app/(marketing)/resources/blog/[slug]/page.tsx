import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";
import { POSTS } from "@/lib/posts";

// Render inline [label](url) markdown links inside post paragraphs.
// Internal links (starting with "/") use Next <Link> for SPA navigation + SEO;
// external links open in a new tab.
function renderInline(text: string): ReactNode[] {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [, label, url] = match;
    if (url.startsWith("/")) {
      nodes.push(
        <Link key={key++} href={url} className="font-medium text-accent underline-offset-2 hover:underline">
          {label}
        </Link>
      );
    } else {
      nodes.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
          {label}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

const SITE_URL = "https://ansaraeo.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  const url = `${SITE_URL}/resources/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords,
    alternates: { canonical: `/resources/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url,
      siteName: "AnsarAEO",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const related = POSTS.filter((p) => p.category === post.category && p.slug !== post.slug).slice(0, 2);
  const url = `${SITE_URL}/resources/blog/${post.slug}`;

  // BlogPosting structured data — lets Google / answer engines understand and cite the article.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    articleSection: post.category,
    keywords: post.keywords?.join(", "),
    author: { "@type": "Person", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "AnsarAEO",
      url: SITE_URL,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    inLanguage: "en-IN",
  };

  // FAQPage structured data — self-contained Q/A that AI answer engines lift directly.
  const faqSchema =
    post.faqs && post.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
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
              {post.content.map((block, i) =>
                block.startsWith("## ") ? (
                  <h2 key={i} className="mt-10 text-xl font-bold tracking-tight text-ink md:text-2xl">
                    {block.slice(3)}
                  </h2>
                ) : (
                  <p key={i} className="mt-5 text-[15px] leading-[1.8] text-ink/80">
                    {renderInline(block)}
                  </p>
                )
              )}
            </article>

            {post.faqs && post.faqs.length > 0 && (
              <section className="mt-14" aria-labelledby="faq-heading">
                <h2 id="faq-heading" className="text-xl font-bold tracking-tight md:text-2xl">
                  Frequently asked questions
                </h2>
                <dl className="mt-6 space-y-6">
                  {post.faqs.map((f, i) => (
                    <div key={i} className="border-t border-line pt-6">
                      <dt className="text-[15px] font-semibold text-ink">{f.q}</dt>
                      <dd className="mt-2 text-[15px] leading-[1.8] text-ink/80">{renderInline(f.a)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
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
