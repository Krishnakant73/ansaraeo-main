import { Check, Minus, TrendingDown, TrendingUp } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const ROWS = [
  { prompt: "best ayurvedic shampoo in india", lang: "EN", engines: "ChatGPT · Perplexity · Gemini", visibility: 86, trend: "+12", cited: true },
  { prompt: "sabse accha protein powder kaunsa hai", lang: "HI", engines: "ChatGPT · Gemini", visibility: 74, trend: "+9", cited: true },
  { prompt: "affordable d2c skincare brands", lang: "EN", engines: "Perplexity", visibility: 58, trend: "+4", cited: true },
  { prompt: "wedding sherwani online shopping", lang: "HI", engines: "ChatGPT", visibility: 41, trend: "-3", cited: false },
  { prompt: "best crm for indian smb", lang: "EN", engines: "ChatGPT · Perplexity", visibility: 33, trend: "+2", cited: false },
];

export default function AnalyticsTable() {
  return (
    <SectionWrapper className="bg-surface py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">Every prompt. Every engine. One table.</h2>
          <p className="mt-5 text-muted md:text-lg">
            Click into any prompt to see the full AI response, your position, sentiment and cited sources.
          </p>
        </div>
        <div className="card mx-auto mt-14 max-w-4xl overflow-hidden hover:!translate-y-0 hover:!scale-100">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-6 py-4 font-medium">Prompt</th>
                  <th className="px-4 py-4 font-medium">Lang</th>
                  <th className="px-4 py-4 font-medium">Engines</th>
                  <th className="px-4 py-4 font-medium">Visibility</th>
                  <th className="px-4 py-4 font-medium">Trend</th>
                  <th className="px-6 py-4 font-medium">Cited</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.prompt} className="border-b border-line/60 transition-colors last:border-0 hover:bg-surface/70">
                    <td className="px-6 py-4 font-medium">“{r.prompt}”</td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-grid px-2 py-0.5 text-xs font-semibold">{r.lang}</span>
                    </td>
                    <td className="px-4 py-4 text-xs text-muted">{r.engines}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-grid">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${r.visibility}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-accent">{r.visibility}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={
                          r.trend.startsWith("+")
                            ? "inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"
                            : "inline-flex items-center gap-1 text-xs font-semibold text-red-500"
                        }
                      >
                        {r.trend.startsWith("+") ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
                        {r.trend}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {r.cited ? (
                        <Check className="h-4 w-4 text-emerald-600" aria-label="Cited" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted" aria-label="Not cited" />
                      )}
                    </td>
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
