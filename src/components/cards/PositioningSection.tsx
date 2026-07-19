import SectionWrapper from "@/components/layout/SectionWrapper";

const TARGET_CUSTOMERS = [
  {
    title: "D2C & ecommerce brands",
    desc: "Teams who own discovery but can't see whether AI assistants recommend them over a rival.",
  },
  {
    title: "Agencies & consultants",
    desc: "Who report AI-search visibility to Indian clients and need proof, not vibes.",
  },
  {
    title: "Local & regional businesses",
    desc: "Brands whose buyers ask in Hindi, Hinglish and Tamil — and get answered by AI first.",
  },
];

export default function PositioningSection() {
  return (
    <SectionWrapper id="positioning" className="py-24 md:py-40">
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Our positioning</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            From invisible in AI search to consistently recommended.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted md:text-lg">
            Your buyers now start with a question to an AI assistant, not a search bar. AnsarAEO is the
            system of record for whether those answers name you — and what to change so they do.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="card border-line p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Today</p>
            <h3 className="mt-3 text-xl font-bold tracking-tight">The current behavior</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
              <li>• A competitor gets recommended; you&rsquo;re never named.</li>
              <li>• You guess which prompts matter and can&rsquo;t measure the gap.</li>
              <li>• Visibility is a feeling, not a number — until the sales disappear.</li>
            </ul>
          </div>
          <div className="card border-accent/30 bg-accent/[0.03] p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">With AnsarAEO</p>
            <h3 className="mt-3 text-xl font-bold tracking-tight">The desired behavior</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
              <li>• Every tracked prompt shows whether AI cites, recommends, or ignores you.</li>
              <li>• You see the exact wording AI uses — and the gap vs how you want to be seen.</li>
              <li>• One-click drafts close the gap, in the languages your customers use.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 card p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Who it&rsquo;s for</p>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {TARGET_CUSTOMERS.map((c) => (
              <div key={c.title}>
                <h3 className="font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
