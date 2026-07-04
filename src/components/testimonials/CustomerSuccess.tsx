import SectionWrapper from "@/components/layout/SectionWrapper";

const METRICS = [
  { value: "+303%", label: "Visibility lift in 90 days" },
  { value: "7/10", label: "Money prompts won on ChatGPT" },
  { value: "₹4.2L", label: "Monthly revenue attributed to AI search" },
  { value: "6 hrs", label: "Max data freshness, always shown" },
];

export default function CustomerSuccess() {
  return (
    <SectionWrapper className="py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-[42px] md:leading-tight">Proof, not promises.</h2>
          <p className="mt-5 text-muted md:text-lg">What happens when an Indian D2C brand takes AI search seriously.</p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-2">
          <figure className="card flex flex-col justify-between p-8 md:p-10">
            <blockquote className="text-xl font-medium leading-relaxed text-ink/90 md:text-[22px]">
              “We stopped guessing what ChatGPT says about us. Within a quarter, AI answers became our third-largest
              acquisition channel — and the only one with zero ad spend.”
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-sm font-bold text-white">
                AS
              </span>
              <span>
                <span className="block font-semibold">Ananya Sharma</span>
                <span className="block text-sm text-muted">Founder, Lumora Skincare</span>
              </span>
              <span className="ml-auto text-sm font-bold tracking-widest text-muted">LUMORA</span>
            </figcaption>
          </figure>
          <div className="card p-8 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Case study</p>
            <h3 className="mt-3 text-[22px] font-bold leading-snug tracking-tight">
              Lumora: from invisible to ChatGPT’s top pick
            </h3>
            <div className="mt-8 grid grid-cols-2 gap-6">
              {METRICS.map((m) => (
                <div key={m.label}>
                  <p className="text-3xl font-extrabold tracking-tight text-accent">{m.value}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
