import { Check } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const COLUMNS = [
  {
    title: "Pitch",
    desc: "Win new business with data the prospect has never seen.",
    bullets: ["Free lite audits, no site access", "Branded proposal exports", "Competitor gap snapshots", "Hindi & English coverage"],
  },
  {
    title: "Manage",
    desc: "Run every client from a single, fast workspace.",
    bullets: ["Client switcher & portfolio view", "Role-based permissions", "Bulk prompt management", "Per-client billing tags"],
  },
  {
    title: "Report",
    desc: "Prove value weekly without lifting a finger.",
    bullets: ["White-label PDF reports", "Top 5 opportunities digest", "Slack & WhatsApp alerts", "Revenue attribution views"],
  },
];

export default function FeatureMatrix() {
  return (
    <SectionWrapper className="bg-surface py-24 md:py-36">
      <div className="container-x">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-5xl">The agency workflow, covered.</h2>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
          {COLUMNS.map((c) => (
            <div key={c.title} className="card flex h-full flex-col p-8">
              <h3 className="text-[22px] font-bold tracking-tight text-accent">{c.title}</h3>
              <p className="mt-2 text-sm leading-[1.7] text-muted">{c.desc}</p>
              <ul className="mt-6 space-y-3">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
