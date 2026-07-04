import { Check, X } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const ROWS = [
  { feature: "Native Hindi & Hinglish prompt tracking", us: true, a: false, b: false },
  { feature: "SMB pricing in ₹ (from ₹1,999/mo)", us: true, a: false, b: false },
  { feature: "Auto-Fix with one-click CMS deploy", us: true, a: false, b: true },
  { feature: "Revenue attribution (GA4 + Razorpay)", us: true, a: true, b: false },
  { feature: "WhatsApp visibility alerts", us: true, a: false, b: false },
  { feature: "Agency white-label reports", us: true, a: true, b: true },
  { feature: "One-click cancel, no dark patterns", us: true, a: false, b: false },
];

function Cell({ v }: { v: boolean }) {
  return v ? (
    <Check className="mx-auto h-4 w-4 text-[#23A55A]" aria-label="Included" />
  ) : (
    <X className="mx-auto h-4 w-4 text-muted/50" aria-label="Not included" />
  );
}

export default function ComparisonTable() {
  return (
    <SectionWrapper className="bg-surface py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-[42px] md:leading-tight">Built different, on purpose.</h2>
          <p className="mt-5 text-muted md:text-lg">How AnsarAEO compares to global AEO platforms for Indian brands.</p>
        </div>
        <div className="card mx-auto mt-14 max-w-3xl overflow-hidden hover:!translate-y-0 hover:!scale-100">
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-6 py-4 font-medium">Feature</th>
                  <th className="px-4 py-4 text-center font-semibold text-accent">AnsarAEO</th>
                  <th className="px-4 py-4 text-center font-medium">Global Tool A</th>
                  <th className="px-6 py-4 text-center font-medium">Global Tool B</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.feature} className="border-b border-line/60 transition-colors last:border-0 hover:bg-surface/70">
                    <td className="px-6 py-4 font-medium">{r.feature}</td>
                    <td className="px-4 py-4"><Cell v={r.us} /></td>
                    <td className="px-4 py-4"><Cell v={r.a} /></td>
                    <td className="px-6 py-4"><Cell v={r.b} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
