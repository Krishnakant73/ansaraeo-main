import type { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What shipped, and when — built in public.",
  alternates: { canonical: "/resources/changelog" },
};

// Real entries — update this file as you actually ship features.
// This is a genuine build-in-public asset (Part 6 GTM strategy): honest,
// dated progress is more credible than a polished-but-vague roadmap page.
const ENTRIES = [
  {
    date: "July 2026",
    tag: "New",
    title: "Multi-engine visibility tracking",
    desc: "ChatGPT, Perplexity, and Gemini now run in parallel for every tracked prompt, with per-engine mention and sentiment results.",
  },
  {
    date: "July 2026",
    tag: "New",
    title: "Onboarding & auto-generated starter prompts",
    desc: "New accounts get 15-20 relevant starter prompts generated automatically based on industry and category — no blank dashboard.",
  },
  {
    date: "July 2026",
    tag: "New",
    title: "Google login, password reset, and improved signup",
    desc: "Added Google OAuth, forgot-password flow, and a required Terms & Privacy Policy acceptance step at signup.",
  },
  {
    date: "July 2026",
    tag: "Fixed",
    title: "Signup reliability fix",
    desc: "Fixed a database trigger bug that could cause new accounts to fail organization setup silently.",
  },
  {
    date: "June 2026",
    tag: "New",
    title: "Core visibility-check engine",
    desc: "The first working end-to-end loop: a tracked prompt goes out to a real AI engine, gets classified for brand mentions and sentiment, and is stored.",
  },
  {
    date: "June 2026",
    tag: "New",
    title: "Public marketing site",
    desc: "Home, Product, Agency, and Pricing pages live.",
  },
];

const TAG_STYLES: Record<string, string> = {
  New: "bg-accent/10 text-accent",
  Fixed: "bg-amber-50 text-amber-700",
  Improved: "bg-emerald-50 text-emerald-700",
};

export default function ChangelogPage() {
  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-16 pt-36 md:pb-20 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Changelog</p>
            <h1 className="mx-auto mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              Built in public.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-muted md:text-lg">
              A running, honest log of what actually shipped — not a polished roadmap.
            </p>
          </div>
        </SectionWrapper>

        <SectionWrapper className="pb-24 md:pb-36">
          <div className="container-x mx-auto max-w-2xl">
            <div className="relative">
              <div aria-hidden className="absolute bottom-4 left-[5px] top-4 w-px bg-line" />
              <ul className="space-y-10">
                {ENTRIES.map((e) => (
                  <li key={e.title} className="relative flex gap-6 pl-6">
                    <span aria-hidden className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted">{e.date}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TAG_STYLES[e.tag]}`}>
                          {e.tag}
                        </span>
                      </div>
                      <h3 className="mt-1.5 font-semibold">{e.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{e.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionWrapper>
      </main>
      <Footer />
    </>
  );
}
