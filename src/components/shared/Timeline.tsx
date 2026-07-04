"use client";

import { motion } from "framer-motion";
import SectionWrapper from "@/components/layout/SectionWrapper";

const STEPS = [
  { title: "Connect your clients", desc: "Add each client's brand, domain and competitors. We auto-suggest 20-30 starter prompts per client in English and Hindi." },
  { title: "First run overnight", desc: "Nightly visibility runs populate every client dashboard before your morning standup — never an empty screen." },
  { title: "Pitch with audits", desc: "Generate a free lite audit for any prospect without site access, branded with your agency logo." },
  { title: "Report on autopilot", desc: "White-label PDF reports every week, per client, ready to forward. Alerts hit Slack or WhatsApp when visibility drops." },
];

export default function Timeline() {
  return (
    <SectionWrapper className="py-24 md:py-36">
      <div className="container-x">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-5xl">Up and running in a week.</h2>
        <div className="relative mx-auto mt-16 max-w-2xl">
          <div aria-hidden className="absolute bottom-4 left-5 top-4 w-px bg-line" />
          <ol className="space-y-12">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                className="relative flex gap-6"
              >
                <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-sm font-bold text-accent shadow-card">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-[1.7] text-muted">{s.desc}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </SectionWrapper>
  );
}
