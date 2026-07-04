"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import SectionWrapper from "@/components/layout/SectionWrapper";

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.8,
      ease: "easeOut",
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to]);

  return (
    <span ref={ref}>
      {val.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

const STATS = [
  { to: 12000, suffix: "+", label: "Prompts tracked daily" },
  { to: 6, suffix: "", label: "AI engines monitored" },
  { to: 5, suffix: "", label: "Indian languages supported" },
];

export default function Metrics() {
  return (
    <SectionWrapper className="py-24 md:py-36">
      <div className="container-x text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Average visibility lift</p>
        <p className="mt-4 bg-gradient-to-b from-ink to-ink/60 bg-clip-text text-[96px] font-extrabold leading-none tracking-tight text-transparent drop-shadow-[0_10px_40px_rgba(214,106,56,0.2)] md:text-[160px]">
          <Counter to={303} suffix="%" />
        </p>
        <p className="mx-auto mt-6 max-w-xl text-muted md:text-lg">
          Median improvement in AI answer mentions within 90 days for brands on AnsarAEO.
        </p>
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-10 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold tracking-tight">
                <Counter to={s.to} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
