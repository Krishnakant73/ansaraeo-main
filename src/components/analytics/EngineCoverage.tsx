import SectionWrapper from "@/components/layout/SectionWrapper";

const ENGINES = [
  { name: "ChatGPT", desc: "The assistant most Indians now open instead of a search tab." },
  { name: "Gemini", desc: "Google's assistant, woven into Search, Android and Workspace." },
  { name: "Perplexity", desc: "The cited answer engine — built to name its sources." },
  { name: "Google AI Overviews", desc: "The AI summary atop billions of Google searches." },
  { name: "Grok", desc: "Conversational AI inside X, where trends break first." },
  { name: "Copilot", desc: "AI across Bing, Edge and Microsoft 365 at work." },
];

export default function EngineCoverage() {
  return (
    <SectionWrapper id="engines" className="py-24 md:py-32">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label text-accent">The engines that decide your discovery</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            Six answer engines. One place your brand needs to show up.
          </h2>
          <p className="mt-5 text-muted md:text-lg">
            Your buyers don&rsquo;t &ldquo;Google it&rdquo; anymore — they ask an AI. AnsarAEO tracks your
            visibility across every engine that matters, in the languages your customers actually use.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENGINES.map((e) => (
            <div key={e.name} className="card p-6">
              <h3 className="text-lg font-bold tracking-tight">{e.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{e.desc}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted">
          Queried the way your customers ask — in Hindi, Hinglish, Tamil, Bengali, Marathi and more.
        </p>
      </div>
    </SectionWrapper>
  );
}
