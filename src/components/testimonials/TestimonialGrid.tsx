import SectionWrapper from "@/components/layout/SectionWrapper";

const ITEMS = [
  { quote: "Setup took one evening. The Monday digest alone is worth the price.", name: "Sneha Kulkarni", role: "Growth Lead", company: "Deshi Roots", initials: "SK" },
  { quote: "White-label reports turned AEO into a retainer line item for us.", name: "Vikram Joshi", role: "Partner", company: "Kaveri Labs", initials: "VJ" },
  { quote: "Finally, a tool that knows how Indians actually ask AI for products.", name: "Farah Khan", role: "CMO", company: "Vastra Co.", initials: "FK" },
];

export default function TestimonialGrid() {
  return (
    <SectionWrapper className="bg-surface py-24 md:py-36">
      <div className="container-x">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-[42px] md:leading-tight">Operators agree.</h2>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
          {ITEMS.map((t) => (
            <figure key={t.name} className="card flex h-full flex-col justify-between p-8">
              <blockquote className="text-sm leading-[1.7] text-ink/80">“{t.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-xs font-bold text-white">
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
