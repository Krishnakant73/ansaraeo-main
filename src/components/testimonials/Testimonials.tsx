import SectionWrapper from "@/components/layout/SectionWrapper";

const ITEMS = [
  {
    quote: "We pitch new clients with an AnsarAEO audit before they even sign. It wins the room every single time.",
    name: "Priya Iyer",
    role: "Director",
    company: "Meridian Digital",
    initials: "PI",
  },
  {
    quote: "ChatGPT now recommends us for 7 of our 10 money prompts — in Hindi. No global tool could even measure that.",
    name: "Ananya Sharma",
    role: "Founder",
    company: "Lumora Skincare",
    initials: "AS",
  },
  {
    quote: "The agent tells me every Monday exactly what to fix. It replaced an entire weekly analytics meeting.",
    name: "Rohan Mehta",
    role: "Head of Growth",
    company: "Zestro",
    initials: "RM",
  },
  {
    quote: "First tool where I could show my CFO that AI search made us real revenue. Budget approved in a day.",
    name: "Arjun Nair",
    role: "CMO",
    company: "NimbusPay",
    initials: "AN",
  },
];

export default function Testimonials() {
  return (
    <SectionWrapper className="py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">Loved by operators.</h2>
          <p className="mt-5 text-muted md:text-lg">Founders, growth leads and agencies across India run on AnsarAEO.</p>
        </div>
        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
          {ITEMS.map((t) => (
            <figure key={t.name} className="card p-8">
              <blockquote className="text-base leading-relaxed text-ink/80">“{t.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-sm font-bold text-white">
                  {t.initials}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted">
                    {t.role}, {t.company}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
