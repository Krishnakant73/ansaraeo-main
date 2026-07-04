import { Briefcase, FileText, Layers, Presentation, Users, Wallet } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const BENEFITS = [
  { icon: Layers, title: "Multi-client workspaces", desc: "Switch between every brand you manage from one dashboard, with an aggregate portfolio visibility view." },
  { icon: FileText, title: "White-label reports", desc: "Weekly PDF reports carrying your agency logo, ready to forward to clients without edits." },
  { icon: Presentation, title: "Pitch mode", desc: "Generate a free lite audit for any prospect — no site access needed — and win the room before the contract." },
  { icon: Users, title: "Seats & roles", desc: "Bulk seat management with role-based permissions, so juniors report and leads approve." },
  { icon: Briefcase, title: "Retainer-ready", desc: "Turn AEO into a recurring line item with deliverables your clients can actually see moving." },
  { icon: Wallet, title: "Margin-friendly ₹ pricing", desc: "Agency plans priced for Indian retainers, so every client you add improves your margin." },
];

export default function BenefitsGrid() {
  return (
    <SectionWrapper className="py-24 md:py-36">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">One login. Every client.</h2>
          <p className="mt-5 text-muted md:text-lg">Built for agencies managing 10-50 brands, not just one.</p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="card flex h-full flex-col p-8">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                <b.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight">{b.title}</h3>
              <p className="mt-2 text-sm leading-[1.7] text-muted">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
