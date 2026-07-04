"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Audience = "brand" | "agency";
type Cycle = "monthly" | "yearly";

const PLANS: Record<Audience, { name: string; desc: string; monthly: number; features: string[]; popular: boolean }[]> = {
  brand: [
    { name: "Starter", desc: "For solo founders getting started with AEO.", monthly: 1999, features: ["25 tracked prompts", "3 AI engines", "English + Hindi", "Weekly email report", "Basic site audit"], popular: false },
    { name: "Growth", desc: "For D2C brands serious about AI search.", monthly: 4999, features: ["100 tracked prompts", "5 AI engines", "All Indian languages", "AI Agent chat", "Auto-Fix deploys", "Revenue attribution"], popular: true },
    { name: "Scale", desc: "For teams tracking many product lines.", monthly: 9999, features: ["300 tracked prompts", "All engines, daily runs", "WhatsApp + Slack alerts", "API access", "Priority support"], popular: false },
  ],
  agency: [
    { name: "Agency Starter", desc: "For boutique agencies with a few clients.", monthly: 7999, features: ["5 client workspaces", "150 tracked prompts", "White-label PDF reports", "Pitch mode audits", "3 team seats"], popular: false },
    { name: "Agency Growth", desc: "For agencies scaling AEO retainers.", monthly: 14999, features: ["15 client workspaces", "500 tracked prompts", "Unlimited white-label reports", "Role-based permissions", "10 team seats", "Portfolio dashboard"], popular: true },
    { name: "Agency Scale", desc: "For large multi-brand portfolios.", monthly: 29999, features: ["50 client workspaces", "2,000 tracked prompts", "API access", "Dedicated success manager", "Unlimited seats"], popular: false },
  ],
};

function inr(n: number) {
  return "\u20b9" + Math.round(n).toLocaleString("en-IN");
}

function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="relative inline-flex rounded-full border border-line bg-white p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200",
            value === o.value ? "text-white" : "text-muted hover:text-ink"
          )}
        >
          {value === o.value && (
            <motion.span layoutId={label} className="absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function PricingCards() {
  const [audience, setAudience] = useState<Audience>("brand");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const yearly = cycle === "yearly";

  return (
    <section aria-label="Pricing plans" className="container-x pb-12 pt-10">
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Segmented
          label="Audience"
          value={audience}
          onChange={setAudience}
          options={[
            { value: "brand", label: "For Brands" },
            { value: "agency", label: "For Agencies" },
          ]}
        />
        <Segmented
          label="Billing cycle"
          value={cycle}
          onChange={setCycle}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly · 2 months free" },
          ]}
        />
      </div>
      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {PLANS[audience].map((p) => {
          const price = yearly ? (p.monthly * 10) / 12 : p.monthly;
          return (
            <div
              key={p.name}
              className={cn(
                "card relative flex h-full flex-col p-8",
                p.popular && "border-accent ring-1 ring-accent"
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white shadow-glow">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold tracking-tight">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">{p.desc}</p>
              <p className="mt-6">
                <span className="text-4xl font-extrabold tracking-tight">{inr(price)}</span>
                <span className="text-sm text-muted">/mo{yearly && ", billed yearly"}</span>
              </p>
              <Link href="/signup" className={cn("mt-6 w-full", p.popular ? "btn-primary" : "btn-secondary")}>
                Start Free
              </Link>
              <ul className="mt-8 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-muted">All plans: 14-day free trial · No card required · One-click cancel</p>
    </section>
  );
}
