import Link from "next/link";
import { ArrowRight, Bell, IndianRupee, Languages, Wand2 } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const POINTS = [
  {
    icon: Languages,
    title: "Native Hindi & Hinglish tracking",
    desc: "Prompts written and evaluated in Hindi, Hinglish, Tamil and Bengali — not machine-translated English.",
  },
  {
    icon: Wand2,
    title: "Auto-Fix, not just advice",
    desc: "We draft the schema markup and content, then push it to WordPress or Shopify in one click.",
  },
  {
    icon: IndianRupee,
    title: "Revenue attribution built-in",
    desc: "AI search to sessions to orders to revenue in one native view, with GA4, Shopify and Razorpay.",
  },
];

const HINDI_PROMPTS = [
  { label: "sabse accha protein powder", v: 74 },
  { label: "best kurta brands online", v: 61 },
  { label: "ayurvedic face wash kaunsa le", v: 48 },
];

export default function FeatureSection() {
  return (
    <SectionWrapper id="features" className="py-24 md:py-40">
      <div className="container-x grid items-center gap-16 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Why AnsarAEO</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            See it. Understand it. Fix it.
          </h2>
          <p className="mt-5 max-w-lg text-muted md:text-lg">
            Global tools stop at charts. AnsarAEO closes the loop — from spotting a visibility gap to shipping the fix
            that wins the mention.
          </p>
          <ul className="mt-10 space-y-7">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/signup" className="btn-secondary mt-10">
            Explore the platform <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="relative">
          <div className="card p-6 md:p-8">
            <p className="text-xs font-medium text-muted">Hindi prompt performance</p>
            <div className="mt-4 space-y-4">
              {HINDI_PROMPTS.map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>“{r.label}”</span>
                    <span className="text-accent">{r.v}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-grid">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${r.v}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[11px] text-muted">Last checked 4 hours ago via live model queries</p>
          </div>
          <div className="card absolute -left-4 -top-8 hidden w-64 items-start gap-3 p-4 sm:flex">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Bell className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold">Visibility alert</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                You gained a citation on Perplexity for “best d2c skincare”.
              </p>
            </div>
          </div>
          <div className="card absolute -bottom-10 -right-4 hidden w-60 p-4 sm:block">
            <p className="text-xs font-semibold">Auto-Fix ready</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              FAQ schema drafted for /pricing — review &amp; push to Shopify.
            </p>
            <span className="mt-2 inline-block rounded-full bg-accent px-3 py-1 text-[10px] font-semibold text-white">
              1-click deploy
            </span>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
