import type { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";

export const metadata: Metadata = {
  title: "Docs",
  description: "How to set up your AnsarAEO account and use the platform.",
  alternates: { canonical: "/resources/docs" },
};

export default function DocsPage() {
  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-16 pt-36 md:pb-20 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Docs</p>
            <h1 className="mx-auto mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              Getting started.
            </h1>
          </div>
        </SectionWrapper>

        <SectionWrapper className="pb-24 md:pb-36">
          <div className="container-x prose prose-sm mx-auto max-w-3xl">
            <p className="rounded-xl bg-accent/10 p-4 text-sm text-ink/80">
              We&apos;re in early access — this page documents what&apos;s live today and will grow with the
              product. Missing something you need? <a href="mailto:admin@ansaraeo.com">Email us</a>.
            </p>

            <h2>1. Create your account</h2>
            <p>
              Sign up with email or Google at <code>/signup</code>. You&apos;ll receive a confirmation email —
              click the link, then log in. An organization is created for you automatically.
            </p>

            <h2>2. Set up your first brand</h2>
            <p>
              After logging in, you&apos;ll be guided to <code>/dashboard/onboarding</code>. Enter your brand
              name, domain, industry, and product category. We auto-generate a starter set of prompts in English
              and/or Hindi so your dashboard isn&apos;t empty on day one.
            </p>

            <h2>3. Track prompts</h2>
            <p>
              From <code>/dashboard/prompts</code>, add any question you want to track and click{" "}
              <strong>Run check now</strong>. This queries ChatGPT, Perplexity, and Gemini live, classifies
              whether your brand was mentioned and with what sentiment, and stores the result.
            </p>

            <h2>4. Read your dashboard</h2>
            <p>
              <code>/dashboard</code> shows your visibility score (the share of tracked runs where you were
              mentioned), total prompts, and total runs, updated as checks complete.
            </p>

            <h2>5. API access (coming to self-serve accounts soon)</h2>
            <p>
              The core visibility-check endpoint already exists internally. Once general API access ships,
              you&apos;ll be able to trigger checks and pull results programmatically. Reach out if you need early
              API access for an integration.
            </p>

            <h2>Need help?</h2>
            <p>
              Email <a href="mailto:admin@ansaraeo.com">admin@ansaraeo.com</a> — we personally read every message
              at this stage.
            </p>
          </div>
        </SectionWrapper>
      </main>
      <Footer />
    </>
  );
}
