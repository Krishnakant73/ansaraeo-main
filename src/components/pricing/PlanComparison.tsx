import { Fragment } from "react";
import { Check, X } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

type Value = boolean | string;

const GROUPS: { cat: string; rows: { label: string; values: Value[] }[] }[] = [
  {
    cat: "Tracking",
    rows: [
      { label: "Tracked prompts", values: ["25", "100", "300", "Custom"] },
      { label: "AI engines", values: ["3", "5", "All", "All"] },
      { label: "Run frequency", values: ["Weekly", "Nightly", "Daily", "Custom"] },
    ],
  },
  {
    cat: "Languages",
    rows: [
      { label: "Hindi & Hinglish", values: [true, true, true, true] },
      { label: "Tamil, Bengali, Marathi", values: [false, true, true, true] },
    ],
  },
  {
    cat: "Automation",
    rows: [
      { label: "Auto-Fix deploys", values: [false, true, true, true] },
      { label: "API access", values: [false, false, true, true] },
    ],
  },
  {
    cat: "Reporting",
    rows: [
      { label: "White-label reports", values: [false, false, true, true] },
      { label: "Revenue attribution", values: [false, true, true, true] },
      { label: "WhatsApp alerts", values: [false, true, true, true] },
    ],
  },
  {
    cat: "Support",
    rows: [{ label: "Support level", values: ["Email", "Priority", "Priority", "Dedicated"] }],
  },
];

const PLAN_NAMES = ["Starter", "Growth", "Scale", "Enterprise"];

function Cell({ v }: { v: Value }) {
  if (typeof v === "string") return <span className="text-sm font-medium">{v}</span>;
  return v ? (
    <Check className="mx-auto h-4 w-4 text-[#22C55E]" aria-label="Included" />
  ) : (
    <X className="mx-auto h-4 w-4 text-muted/50" aria-label="Not included" />
  );
}

export default function PlanComparison() {
  return (
    <SectionWrapper className="py-24 md:py-32">
      <div className="container-x">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-5xl">Compare plans in detail.</h2>
        <div className="card mx-auto mt-14 max-w-4xl overflow-hidden hover:!translate-y-0 hover:!scale-100">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-6 py-4 font-medium">Feature</th>
                  {PLAN_NAMES.map((n) => (
                    <th key={n} className={n === "Growth" ? "px-4 py-4 text-center font-semibold text-accent" : "px-4 py-4 text-center font-medium"}>
                      {n}
                      {n === "Growth" && (
                        <span className="ml-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-semibold normal-case text-accent">Popular</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((g) => (
                  <Fragment key={g.cat}>
                    <tr className="border-b border-line/60 bg-surface">
                      <th colSpan={5} scope="colgroup" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                        {g.cat}
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.label} className="border-b border-line/60 text-center transition-colors last:border-0 hover:bg-surface/70">
                        <td className="px-6 py-4 text-left text-sm font-medium">{r.label}</td>
                        {r.values.map((v, i) => (
                          <td key={i} className="px-4 py-4">
                            <Cell v={v} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
