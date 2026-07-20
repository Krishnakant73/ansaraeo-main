import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import Link from "next/link";
import { Building2, CheckCircle2, Shield, Users } from "lucide-react";

// ============================================================
// /enterprise — talk-to-sales landing page.
//
// Enterprise doesn't self-serve. This page collects intent + brand
// count + SSO requirement, routes to the existing /api/contact endpoint,
// and promises a live scan on the prospect's brand before the call.
// ============================================================

export const metadata = {
  title: "AnsarAEO for Enterprise",
  description: "Tracking AI-search visibility for portfolios of 5+ brands.",
};

export default function EnterprisePage() {
  return (
    <>
      <Navbar />
      <main className="container-x pb-28 pt-32">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Enterprise</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            AI-search visibility for portfolios.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            You have 5+ brands to track, need SSO, and want your own analyst reviewing the report every week.
            We&apos;ll run a live scan on your top brand before the intro call — the report is the deck.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Feature icon={<Building2 className="h-5 w-5" />} title="Multi-brand rollup">
              Portfolio dashboards, per-brand nightly runs, cross-brand comparison.
            </Feature>
            <Feature icon={<Shield className="h-5 w-5" />} title="SSO + audit log">
              SAML/Google Workspace/Okta. Every action logged. SOC 2 roadmap on request.
            </Feature>
            <Feature icon={<Users className="h-5 w-5" />} title="Named analyst">
              A human on the account. Weekly async recap, monthly deep-dive call.
            </Feature>
          </div>

          <div className="mt-14 card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Talk to us</h2>
            <p className="mt-1 text-sm text-muted">
              Reply directly to the confirmation email with your top brand&apos;s domain — we&apos;ll run the scan and send
              you the report within 24 hours.
            </p>
            <form action="/api/contact" method="POST" className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Your name
                  <input
                    required
                    name="name"
                    type="text"
                    className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                    placeholder="Priya Krishnan"
                  />
                </label>
                <label className="text-sm font-medium">
                  Work email
                  <input
                    required
                    name="email"
                    type="email"
                    className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                    placeholder="priya@yourcompany.com"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium">
                Company
                <input
                  required
                  name="company"
                  type="text"
                  className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                  placeholder="Your company"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Brands to track
                  <select
                    name="brandCount"
                    className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                    defaultValue="5-10"
                  >
                    <option value="5-10">5-10</option>
                    <option value="11-25">11-25</option>
                    <option value="26-50">26-50</option>
                    <option value="50+">50+</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  SSO required
                  <select
                    name="sso"
                    className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                    defaultValue="no"
                  >
                    <option value="no">Not required</option>
                    <option value="yes">Yes — Google/Okta/SAML</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium">
                Anything else we should know?
                <textarea
                  name="message"
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                  placeholder="Optional context — timelines, incumbent tools, priorities."
                />
              </label>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted">
                  Prefer self-serve? <Link href="/" className="text-accent underline">Run a free scan</Link>.
                </p>
                <button type="submit" className="btn-primary">
                  Book an intro call
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
