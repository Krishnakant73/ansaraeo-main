import SectionWrapper from "@/components/layout/SectionWrapper";
import DashboardPreview from "@/components/dashboard/DashboardPreview";

const POINTS = [
  { title: "Visibility Score", desc: "One number for how often AI names you across every engine and language." },
  { title: "Share of Voice", desc: "See exactly where competitors win the mention — and by how much." },
  { title: "Top Opportunities", desc: "A ranked, actionable to-do list, refreshed with every run." },
];

export default function DashboardShowcase() {
  return (
    <SectionWrapper className="py-24 md:py-36">
      <div className="container-x grid items-center gap-16 lg:grid-cols-2">
        <div>
          <p className="section-label text-accent">Your AI-search command center</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            See your visibility at a glance — and what to do next.
          </h2>
          <p className="mt-5 text-muted md:text-lg">
            Everything in one view: your mention rate, who you&rsquo;re losing to, and the fixes that move the
            score. No spreadsheet, no dashboard spelunking.
          </p>
          <ul className="mt-10 space-y-7">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <DashboardPreview />
        </div>
      </div>
    </SectionWrapper>
  );
}
