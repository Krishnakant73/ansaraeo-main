import Link from "next/link";
import { Check } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const PLANS = [
  {
    name: "Starter",
    price: "₹1,999",
    period: "/mo",
    desc: "For solo founders getting started with AEO.",
    features: ["25 tracked prompts", "3 AI engines", "English + Hindi", "Weekly email report"],
    popular: false,
  },
  {
    name: "Growth",
    price: "₹4,999",
    period: "/mo",
    desc: "For D2C brands serious about AI search.",
    features: ["100 tracked prompts", "5 AI engines", "All Indian languages", "Auto-Fix deploys"],
    popular: true,
  },
  {
    name: "Scale",
    price: "₹9,999",
    period: "/mo",
    desc: "For teams tracking many product lines.",
    features: ["300 tracked prompts", "All engines, daily runs", "WhatsApp + Slack alerts", "API access"],
    popular: false,
  },
];

export default function PricingPreview() {
  return (
    <SectionWrapper className="py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label text-accent">Pricing</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            Real value at every tier. Priced in ₹.
          </h2>
          <p className="mt-5 text-muted md:text-lg">Start free, no card required. Upgrade when you&rsquo;re ready.</p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`card relative flex h-full flex-col p-8 ${p.popular ? "border-accent ring-1 ring-accent" : ""}`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white shadow-glow">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold tracking-tight">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">{p.desc}</p>
              <p className="mt-6">
                <span className="text-4xl font-extrabold tracking-tight">{p.price}</span>
                <span className="text-sm text-muted">{p.period}</span>
              </p>
              <ul className="mt-8 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/pricing" className="btn-secondary">
            Compare all plans
          </Link>
        </div>
      </div>
    </SectionWrapper>
  );
}
